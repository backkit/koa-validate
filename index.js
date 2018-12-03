/**
 * Validator wrapper
 */
class Validator {
  /**
   * @param {ValidationGroup} group
   * @param {String} ns - group namespace
   * @param {String} name - actual validator name
   * @param {Mixed} params - validator params
   * @param {Object} - config
   */
  constructor(group, ns, name, params, config) {
    this.group = group;
    this.ns = ns;
    this.name = name;
    this.params = params;
    this.getValidator = config.getValidator;
    this.logger = config.logger;
  } 

  async run() {
    const value = this.group.value;
    const ns = this.ns;
    const name = this.name;
    const params = this.params;
    const _validate = this.getValidator(ns, name);
    if (_validate) {
      return await _validate(value, params);
    }
    this.logger.error(`validator "${ns}/${name}" not found`);
    return false;
  }
}

/**
 * ValidationGroup
 *
 * Contains many validators to run
 */
class ValidationGroup {
  /**
   * @param {String} name - group name/namespace
   * @param {Mixed} value - value to validate
   * @param {String} defaultErr - default error message
   * @param {Object} config
   */
  constructor(name, value, defaultErr, config) {
    this.name = name;
    this.value = value;
    this.defaultErr = defaultErr || `invalid value for ${name}`;
    this.validatorChain = [];
    this.getValidator = config.getValidator;
    this.logger = config.logger;
    this.isOptional = false;
  }

  async execValidationChain() {
    for (let v of this.validatorChain) {
      try {
        const result = await v.run();
        this.logger.verbose(`koa-validate: validating => ${v.ns}/${v.name}, ${result === true ? 'PASS' : 'BLOCKED'}`);
        if (result === true) {
          return true;
        } else if (result === false) {
          // we throw an error with default error message
          return new Error(this.defaultErr);
        } else if (result instanceof Error) {
          // we throw an existing error
          return result;
        } else {
          // we return default error, because only an error or false is supposed to be returned as error
          return new Error(this.defaultErr);
        }
      } catch (err) {
        // log an actual error, but respond with default error to hide real error to end user
        this.logger.verbose(`koa-validate: validating => ${v.ns}/${v.name}, BLOCKED`, {err: err.message});
        return new Error(this.defaultErr);
      }
    }
  }

  pushValidator(ns, name, params) {
    const val = new Validator(this, ns, name, params||{}, {getValidator: this.getValidator, logger: this.logger});
    this.validatorChain.push(val);
    return this;
  }
}

/**
 * To provide dynamic validator namespace loading, we proxy the validation group
 * to intercept validator namespaces like .string('actual validator name')
 */
const ValidationGroupProxy = (obj) => {
  const handler = {
    get(target, propKey, receiver) {
      if (propKey in target) {
        return target[propKey];
      }
      return function(_name, ...args) {
        return target.pushValidator(propKey, _name, args);
      };
    }
  };
  return new Proxy(obj, handler);
};

/**
 * Koa validate service
 * - request validation
 * - request authentication
 * - request authorization
 *
 */
const KoaValidate = ({koa, validator, logger}) => {
  const validators = {};
  const getValidator = (_ns, _name) => {
    return validator.get(_ns, _name);
  };

  koa.app.use(async (ctx, next) => {

    // request validation
    ctx.checkBody = (name, errMsg) => {
      const data = ctx.request.body || {};
      ctx.__requestValidators = ctx.__requestValidators || [];
      const _u = new ValidationGroup(name, data[name], errMsg, {getValidator, logger});
      const u = ValidationGroupProxy(_u);
      ctx.__requestValidators.push(u);
      return u;
    };
    ctx.checkQuery = (name, errMsg) => {
      const data = ctx.request.query || {};
      ctx.__requestValidators = ctx.__requestValidators || [];
      const _u = new ValidationGroup(name, data[name], errMsg, {getValidator, logger});
      const u = ValidationGroupProxy(_u);
      ctx.__requestValidators.push(u);
      return u;
    };
    ctx.checkParam = (name, errMsg) => {
      const data = ctx.params || {};
      ctx.__requestValidators = ctx.__requestValidators || [];
      const _u = new ValidationGroup(name, data[name], errMsg, {getValidator, logger});
      const u = ValidationGroupProxy(_u);
      ctx.__requestValidators.push(u);
      return u;
    };

    // runs validate
    ctx.validate = async () => {
      logger.verbose(`koa-validate: started`);
      for (group of ctx.__requestValidators) {
        const res = await group.execValidationChain();
        if (res !== true) {
          logger.verbose(`koa-validate: blocked`);
          ctx.throw(400, res);
        }
      }
      logger.verbose(`koa-validate: passed`);
      return true;
    };
    await next();
  });
  return {};
};

module.exports = KoaValidate;