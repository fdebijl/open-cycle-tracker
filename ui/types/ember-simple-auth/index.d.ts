interface Callback {
  (): void;
}
type Data = Record<string, unknown>;
interface SessionData<T> {
  authenticated: T;
}

declare module 'ember-simple-auth/services/session' {
  import Evented from '@ember/object/evented';
  import Service from '@ember/service';
  import type BaseSessionStore from 'ember-simple-auth/session-stores/base';
  import type Transition from '@ember/routing/-private/transition';

  export default class SessionService<T> extends Service.extend(Evented) {
    isAuthenticated: boolean;
    data: SessionData<T>;
    store: BaseSessionStore;
    attemptedTransition: Transition | null;

    /**
      __Authenticates the session with an `authenticator`__ and appropriate
      arguments. The authenticator implements the actual steps necessary to
      authenticate the session and returns a promise after doing so.
      The session handles the returned promise and when it resolves becomes authenticated, otherwise remains
      unauthenticated. All data the authenticator resolves with will be
      accessible via the {@linkplain SessionService.data} session data's
      `authenticated` property.

      This method returns a promise. A resolving promise indicates that the
      session was successfully authenticated while a rejecting promise
      indicates that authentication failed and the session remains
      unauthenticated. The promise does not resolve with a value; instead, the
      data returned from the authenticator is available via the
      {@linkplain SessionService.data} property.

      When authentication succeeds this will trigger the
      {@linkplain SessionService.authenticationSucceeded} event.

      @memberof SessionService
      @method authenticate
      @param {String} authenticator The authenticator to use to authenticate the session
      @param {Any} [...args] The arguments to pass to the authenticator; depending on the type of authenticator these might be a set of credentials, a Facebook OAuth Token, etc.
      @return {RSVP.Promise} A promise that resolves when the session was authenticated successfully and rejects otherwise
      @public
    */
    authenticate(authenticator: string, ...args: unknown[]): Promise<void>;

    /**
      __Invalidates the session with the authenticator it is currently
      authenticated with__ (see
      {@linkplain SessionService.authenticate}). This
      invokes the authenticator's
      {@linkplain BaseAuthenticator.invalidate} method
      and handles the returned promise accordingly.

      This method returns a promise. A resolving promise indicates that the
      session was successfully invalidated while a rejecting promise indicates
      that invalidation failed and the session remains authenticated. Once the
      session is successfully invalidated it clears all of its authenticated data
      (see {@linkplain SessionService.data}).

      When invalidation succeeds this will trigger the
      {@linkplain SessionService.invalidationSucceeded}
      event.

      When calling the {@linkplain BaseAuthenticator.invalidate}
      on an already unauthenticated session, the method will return a resolved Promise
      immediately.

      @memberof SessionService
      @method invalidate
      @param {Array} ...args arguments that will be passed to the authenticator
      @return {RSVP.Promise} A promise that resolves when the session was invalidated successfully and rejects otherwise
      @public
    */
    invalidate(...args: unknown[]): Promise<unknown>;

    /**
      Checks whether the session is authenticated and if it is not, transitions
      to the specified route or invokes the specified callback.

      If a transition is in progress and is aborted, this method will save it in the
      session service's
      {@linkplain SessionService.attemptedTransition}
      property so that  it can be retried after the session is authenticated. If
      the transition is aborted in Fastboot mode, the transition's target URL
      will be saved in a `ember_simple_auth-redirectTarget` cookie for use by the
      browser after authentication is complete.

      @memberof SessionService
      @method requireAuthentication
      @param {Transition} transition A transition that triggered the authentication requirement or null if the requirement originated independently of a transition
      @param {String|Function} routeOrCallback The route to transition to in case that the session is not authenticated or a callback function to invoke in that case
      @return {Boolean} true when the session is authenticated, false otherwise
      @public
    */
    requireAuthentication(transition: Transition, routeOrCallback: string | Callback): boolean;


    /**
      Checks whether the session is authenticated and if it is, transitions
      to the specified route or invokes the specified callback.

      @memberof SessionService
      @method prohibitAuthentication
      @param {String|Function} routeOrCallback The route to transition to in case that the session is authenticated or a callback function to invoke in that case
      @return {Boolean} true when the session is not authenticated, false otherwise
      @public
    */
    prohibitAuthentication(routeOrCallback: string | Callback): boolean;

    /**
      This method is called whenever the session goes from being unauthenticated
      to being authenticated. If there is a transition that was previously
      intercepted by the
      {@linkplain SessionService.requireAuthentication},
      it will retry it. If there is no such transition, the
      `ember_simple_auth-redirectTarget` cookie will be checked for a url that
      represents an attemptedTransition that was aborted in Fastboot mode,
      otherwise this action transitions to the specified
      routeAfterAuthentication.

      @memberof SessionService
      @method handleAuthentication
      @param {String} routeAfterAuthentication The route to transition to
      @public
    */
    handleAuthentication(routeAfterAuthentication: string): void;

    /**
      This method is called whenever the session goes from being authenticated to
      not being authenticated. __It reloads the Ember.js application__ by
      redirecting the browser to the specified route so that all in-memory data
      (such as Ember Data stores etc.) gets cleared.

      If the Ember.js application will be used in an environment where the users
      don't have direct access to any data stored on the client (e.g.
      [cordova](http://cordova.apache.org)) this action can be overridden to e.g.
      simply transition to the index route.

      @memberof SessionService
      @method handleInvalidation
      @param {String} routeAfterInvalidation The route to transition to
      @public
    */
    handleInvalidation(routeAfterInvalidation: string): void;

    /**
      Sets up the session service.

      This method must be called when the application starts up,
      usually as the first thing in the `application` route's `beforeModel`
      method.

      @memberof SessionService
      @method setup
      @public
    */
    setup(): Promise<void>;
  }
}

declare module 'ember-simple-auth/authenticators/base' {
  import EmberObject from '@ember/object';
  import Evented from '@ember/object/evented';

  export default class extends EmberObject.extend(Evented) {
    restore(data: Data): Promise<unknown>;
    authenticate(...args: unknown[]): Promise<unknown>;
    invalidate(data: Data, ...args: unknown[]): Promise<unknown>;
  }
}

declare module 'ember-simple-auth/session-stores/base' {
  import EmberObject from '@ember/object';
  import Evented from '@ember/object/evented';

  export default class extends EmberObject.extend(Evented) {
    persist(data: SessionData<Data>): Promise<unknown>;
    restore(): Promise<SessionData<Data>>;
    clear(): Promise<void>;
  }
}

declare module 'ember-simple-auth/session-stores/local-storage' {
  import BaseSessionStore from 'ember-simple-auth/session-stores/base';

  export default class extends BaseSessionStore {
    key: string;
  }
}

declare module 'ember-simple-auth/session-stores/cookie' {
  import BaseSessionStore from 'ember-simple-auth/session-stores/base';

  export default class extends BaseSessionStore {
    cookieDomain: string;
    cookieExpirationTime: null | number;
    cookieName: string;
    cookiePath: string;
    sameSite: null | 'Strict' | 'Lax';
  }
}

declare module 'ember-simple-auth/session-stores/adaptive' {
  import CookieSessionStore from 'ember-simple-auth/session-stores/base';

  export default class extends CookieSessionStore {
    localStorageKey: string;
  }
}

declare module 'ember-simple-auth/session-stores/ephemeral' {
  import BaseSessionStore from 'ember-simple-auth/session-stores/base';

  export default class extends BaseSessionStore { }
}

declare module 'ember-simple-auth/session-stores/session-storage' {
  import BaseSessionStore from 'ember-simple-auth/session-stores/base';

  export default class extends BaseSessionStore {
    key: string;
  }
}

declare module 'ember-simple-auth/authenticators/test' {
  import BaseAuthenticator from 'ember-simple-auth/authenticators/base';

  export default class extends BaseAuthenticator { }
}

declare module 'ember-simple-auth/authenticators/devise' {
  import BaseAuthenticator from 'ember-simple-auth/authenticators/base';

  /**
    Authenticator that works with the Ruby gem
    [devise](https://github.com/plataformatec/devise).

    __As token authentication is not actually part of devise anymore, the server
    needs to implement some customizations__ to work with this authenticator -
    see [this gist](https://gist.github.com/josevalim/fb706b1e933ef01e4fb6).

    @class DeviseAuthenticator
    @extends BaseAuthenticator
    @public
  */
  export default class extends BaseAuthenticator {
    /**
      The endpoint on the server that the authentication request is sent to.

      @memberof DeviseAuthenticator
      @property serverTokenEndpoint
      @type String
      @default '/users/sign_in'
      @public
    */
    serverTokenEndpoint: string;
    /**
      The devise resource name. __This will be used in the request and also be
      expected in the server's response.__

      @memberof DeviseAuthenticator
      @property resourceName
      @type String
      @default 'user'
      @public
    */
    resourceName: string;
    /**
      The token attribute name. __This will be used in the request and also be
      expected in the server's response.__

      @memberof DeviseAuthenticator
      @property tokenAttributeName
      @type String
      @default 'token'
      @public
    */
    tokenAttributeName: string;
    /**
      The identification attribute name. __This will be used in the request and
      also be expected in the server's response.__

      @memberof DeviseAuthenticator
      @property identificationAttributeName
      @type String
      @default 'email'
      @public
    */
    identificationAttributeName: string;

    /**
      Restores the session from a session data object; __returns a resolving
      promise when there are non-empty token and identification
      values in `data`__ and a rejecting promise otherwise.

      @memberof DeviseAuthenticator
      @method restore
      @param {Object} data The data to restore the session from
      @return {Ember.RSVP.Promise} A promise that when it resolves results in the session becoming or remaining authenticated
      @public
    */
    restore(data: Data): Promise<unknown>;

    /**
      Authenticates the session with the specified `identification` and
      `password`; the credentials are `POST`ed to the server.
      If the credentials are valid the server will responds with a token and identification.
      __If the credentials are valid and authentication succeeds, a promise that
      resolves with the server's response is returned__, otherwise a promise that
      rejects with the server error is returned.

      @memberof DeviseAuthenticator
      @method authenticate
      @param {String} identification The user's identification
      @param {String} password The user's password
      @return {Ember.RSVP.Promise} A promise that when it resolves results in the session becoming authenticated. If authentication fails, the promise will reject with the server response; however, the authenticator reads that response already so if you need to read it again you need to clone the response object first
      @public
    */
    authenticate(identification: string, password: string): Promise<unknown>;

    /**
      Makes a request to the Devise server using
      [ember-fetch](https://github.com/stefanpenner/ember-fetch).

      @memberof DeviseAuthenticator
      @method makeRequest
      @param {Object} data The request data
      @param {Object} options request options that are passed to `fetch`
      @return {Promise} The promise returned by `fetch`
      @protected
    */
    makeRequest(data: Data, options?: RequestInit): Promise<Response>;
  }
}

declare module 'ember-simple-auth/authenticators/oauth2-implicit-grant' {
  import BaseAuthenticator from 'ember-simple-auth/authenticators/base';

  export default class extends BaseAuthenticator { }
}

declare module 'ember-simple-auth/authenticators/oauth2-password-grant' {
  import BaseAuthenticator from 'ember-simple-auth/authenticators/base';

  export default class extends BaseAuthenticator {
    clientId: string | null;
    serverTokenEndpoint: string;
    serverTokenRevocationEndpoint: string | null;
    refreshAccessTokens: boolean;
  }
}

declare module 'ember-simple-auth/authenticators/torii' {
  import BaseAuthenticator from 'ember-simple-auth/authenticators/base';

  export default class extends BaseAuthenticator { }
}

declare module 'ember-simple-auth/test-support' {
  import SimpleAuthSessionService from 'ember-simple-auth/services/session';
  export function currentSession(): SimpleAuthSessionService<Data>;
  export function authenticateSession(sessionData: Data): Promise<void>;
  export function invalidateSession(): Promise<void>;
}

