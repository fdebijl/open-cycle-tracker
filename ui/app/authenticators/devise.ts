import ENV from 'open-cycle-tracker/config/environment';
import BaseDeviseAuthenticator from 'ember-simple-auth/authenticators/devise';

export default class DeviseAuthenticator extends BaseDeviseAuthenticator {
  serverTokenEndpoint = `${ENV.API_URL}/login`;

  async authenticate(identification: string, password: string) {
    const { resourceName, identificationAttributeName, tokenAttributeName } = this;
    const data: Record<string, any> = {};
    data[resourceName] = { password };
    data[resourceName][identificationAttributeName] = identification;

    const response = await this.makeRequest(data);

    if (response.ok) {
      const headers = response.headers;
      const body = await response.json();
      const json = {
        id: body.user.id,
        ...body.user.attributes,
        [tokenAttributeName]: headers.get('Authorization')
      }

      if (this._validate(json)) {
        return json;
      } else {
        throw new Error(`Check that server response includes ${tokenAttributeName} and ${identificationAttributeName}`);
      }
    } else {
      throw response;
    }
}

  _validate(data: Record<string, unknown>) {
    return data[this.tokenAttributeName] && data[this.identificationAttributeName];
  }
}
