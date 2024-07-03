import JSONAPIAdapter from '@ember-data/adapter/json-api';
import ENV from 'open-cycle-tracker/config/environment';
import ModelRegistry from 'ember-data/types/registries/model';
import SessionService from 'open-cycle-tracker/services/session';
import { underscore } from '@ember/string';
import { pluralize } from 'ember-inflector';
import { service } from '@ember/service';

export default class ApplicationAdapter extends JSONAPIAdapter {
  @service session: SessionService;

  host = ENV.API_URL;
  coalesceFindRequests = true;

  pathForType(type: keyof ModelRegistry) {
    return underscore(pluralize(type as string));
  }

  get headers() {
    const headers: Record<string, unknown> = {};
    const token = this.session.data.authenticated.token;

    if (token) {
      headers['Authorization'] = token;
    }

    return headers;
  }

  handleResponse(status: number, headers: Headers, payload: {}, requestData: {}) {
    if (status === 401) {
      this.session.invalidate();
    }

    return super.handleResponse(status, headers, payload, requestData);
  }
}

