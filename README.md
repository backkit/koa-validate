# Koa Validate

`@backkit/validator` is a generic validation library

`@backkit/koa-validate` is a koa integration of `@backkit/validator`:

It allows to specify validators for HTTP payload `body`, `query` params, `route` params, then run all validators in one bloking step in order to proceed only if all the data have been validated.

Unlike many other validation libraries, you have to see  this one as a generic validation tool.

You can do any type of sync or a validation on any piece of  HTTP's request data.


# Install

```
npm install --save @backkit/koa-validate @backkit/validator
```

# Examples

## Validate semantic meaning of a string 1/2 with Open AI

Here we validate any color n english

res/string/is-color-in-english.js

```js
module.exports = ({validator, openai}) => {
  validator.add('string', 'isColorInEnglish', async (value) => {
  	const res = await openai.autocompleteGpt3(
  		`You will check if this sentence is exactly a ONE WORD name of a color in ENGLISH. You will reply By YES or NO, NOTHING Else should be in the output`,
  		value);
    return res === "YES";
  });
};
```

```js
  async koaAction(ctx, next) {
    ctx.checkQuery('colorTextField', "This is not a one word color").string('isColorInEnglish');

    await ctx.validate();
  }
```


## Validate semantic meaning of a string 2/2 with Open AI

Here we validate if the sentence appears to be family friendly

res/string/is-family-friendly.js

```js
module.exports = ({validator, openai}) => {
  validator.add('string', 'isFamilyFriendly', async (value) => {
  	const res = await openai.autocompleteGpt3(
  		`You will check if this sentence is family friendly. You will reply By YES or NO, NOTHING Else should be in the output`,
  		value);
    return res === "YES";
  });
};
```

```js
  async koaAction(ctx, next) {
    ctx.checkBody('someTextField', "Be family friendly please").string('isFamilyFriendly');

    await ctx.validate();
  }
```

## Validate if string is in array

Simple validator to check if a string value part of an array

res/string/is-in-array.js

```js
module.exports = ({validator}) => {
  validator.add('string', 'inArray', async (value, array) => {
    if (typeof(value) !== 'string') return false;
    if (!Array.isArray(array)) return false;
    if (array.indexOf(value) < 0) return false;
    return true;
  });
};
```

```js
  async koaAction(ctx, next) {
    ctx.checkBody('someValue', "Value not allowed").string('inArray', ['one', 'two', 'ten']);

    await ctx.validate();
  }
```

## Validate if a database record exists

A common validation need is to check if an ID exists in the database, here is an example:


res/project/is-existing-db-id.js

```js
module.exports = ({validator, mongoose}) => {
  validator.add('project', 'existsById', async (value) => {
    if (typeof(value) !== 'string') return false;
    
    const project = await mongoose.models.Project.findOne({_id: value});
    if (project) return true;
    return false;
  });
};
```

```js
  async koaAction(ctx, next) {
    ctx.checkParam('id', "Project does not exist").project('existsById');

    await ctx.validate();
  }
```


# What if

- What if an exception occurs in a validator
- validation chain will be rejected

