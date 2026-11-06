const http = require('http');
const https = require('https');
import { readFileSync } from 'fs';

const JsonRPC = function (this: any, opts) {
  this.opts = opts || {};
  this.http = this.opts.ssl ? https : http;
  this.agent = new this.http.Agent({ keepAlive: true, maxSockets: 16, maxFreeSockets: 4, scheduling: 'lifo' });
  this.pending = new Set();
  this.destroyed = false;
};

JsonRPC.prototype.call = function (method, params) {
  return new Promise((resolve, reject) => {
    if (this.destroyed) {
      reject(new Error('RPC client destroyed'));
      return;
    }
    const time = Date.now();
    let requestJSON;

    if (Array.isArray(method)) {
      // multiple rpc batch call
      requestJSON = [];
      method.forEach(function (batchCall, i) {
        requestJSON.push({
          id: time + '-' + i,
          method: batchCall.method,
          params: batchCall.params,
        });
      });
    } else {
      // single rpc call
      requestJSON = {
        id: time,
        method: method,
        params: params,
      };
    }

    // First we encode the request into JSON
    requestJSON = JSON.stringify(requestJSON);

    // prepare request options
    const requestOptions = {
      host: this.opts.host || 'localhost',
      port: this.opts.port || 8332,
      method: 'POST',
      path: '/',
      headers: {
        Host: this.opts.host || 'localhost',
        'Content-Length': requestJSON.length,
      },
      agent: this.agent,
      rejectUnauthorized: this.opts.ssl && this.opts.sslStrict !== false,
    };

    if (this.opts.ssl && this.opts.sslCa) {
      // @ts-ignore
      requestOptions.ca = this.opts.sslCa;
    }

    // use HTTP auth if user and password set
    if (this.opts.cookie) {
      if (!this.cachedCookie) {
        this.cachedCookie = readFileSync(this.opts.cookie).toString();
      }
      // @ts-ignore
      requestOptions.auth = this.cachedCookie;
    } else if (this.opts.user && this.opts.pass) {
      // @ts-ignore
      requestOptions.auth = this.opts.user + ':' + this.opts.pass;
    }

    // Now we'll make a request to the server
    let cbCalled = false;
    const request = this.http.request(requestOptions);

    let reqTimeout;
    const finish = (err, result?) => {
      if (cbCalled) {
        return;
      }
      cbCalled = true;
      clearTimeout(reqTimeout);
      this.pending.delete(cancel);
      if (err) {
        request.destroy();
        reject(err);
      } else {
        resolve(result);
      }
    };
    const cancel = () => finish(new Error('RPC client destroyed'));
    const timeout = (code) => finish(Object.assign(new Error(code), { code }));
    this.pending.add(cancel);

    // Include agent queueing and the entire response body in the deadline.
    reqTimeout = setTimeout(
      () => timeout('ETIMEDOUT'),
      Math.max(1, (this.opts.timeout || 30000) - (Date.now() - time))
    );
    request.setTimeout(this.opts.timeout || 30000, () => timeout('ESOCKETTIMEDOUT'));
    request.on('error', (err) => finish(err));

    request.on('response', (response) => {
      response.on('error', (err) => finish(err));
      response.on('aborted', () => finish(new Error('RPC response aborted')));
      response.on('close', () => {
        if (!response.complete) {
          finish(new Error('Incomplete RPC response'));
        }
      });

      // We need to buffer the response chunks in a nonblocking way.
      let buffer = '';
      response.on('data', function (chunk) {
        buffer = buffer + chunk;
      });
      // When all the responses are finished, we decode the JSON and
      // depending on whether it's got a result or an error, we call
      // emitSuccess or emitError on the promise.
      response.on('end', () => {
        let err;

        if (cbCalled) {
          return;
        }
        try {
          var decoded = JSON.parse(buffer);
        } catch (e) {
          // if we authenticated using a cookie and it failed, read the cookie file again
          if (response.statusCode === 401 /* Unauthorized */ && this.opts.cookie) {
            this.cachedCookie = undefined;
          }

          if (response.statusCode !== 200) {
            err = new Error('Invalid params, response status code: ' + response.statusCode);
            err.code = -32602;
            finish(err);
          } else {
            err = new Error('Problem parsing JSON response from server');
            err.code = -32603;
            finish(err);
          }
          return;
        }

        if (!Array.isArray(decoded)) {
          decoded = [decoded];
        }

        // iterate over each response, normally there will be just one
        // unless a batch rpc call response is being processed
        if (decoded.length === 0) {
          finish(Object.assign(new Error('Invalid JSON-RPC response'), { code: -32603 }));
          return;
        }
        decoded.forEach(function (decodedResponse) {
          if (!decodedResponse || typeof decodedResponse !== 'object') {
            finish(Object.assign(new Error('Invalid JSON-RPC response'), { code: -32603 }));
            return;
          }
          if (Object.prototype.hasOwnProperty.call(decodedResponse, 'error') && decodedResponse.error) {
            err = new Error(decodedResponse.error.message || '');
            if (decodedResponse.error.code) {
              err.code = decodedResponse.error.code;
            }
            finish(err);
          } else if (Object.prototype.hasOwnProperty.call(decodedResponse, 'result')) {
            finish(null, decodedResponse.result);
          } else {
            err = new Error('Invalid JSON-RPC response');
            err.code = -32603;
            finish(err);
          }
        });
      });
    });
    request.end(requestJSON);
  });
};

module.exports.JsonRPC = JsonRPC;

JsonRPC.prototype.destroy = function () {
  if (this.destroyed) {
    return;
  }
  this.destroyed = true;
  for (const cancel of this.pending) {
    cancel();
  }
  this.agent.destroy();
};
