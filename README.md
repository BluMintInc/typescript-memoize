# typescript-memoize

[![npm](https://img.shields.io/npm/v/typescript-memoize.svg)](https://www.npmjs.com/package/typescript-memoize)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/darrylhodgins/typescript-memoize/master/LICENSE)
![Test](https://github.com/darrylhodgins/typescript-memoize/workflows/Test/badge.svg)

A memoize decorator for Typescript.

## Installation

```
npm install --save typescript-memoize
```

## Usage:

```typescript
@Memoize(hashFunction?: (...args: any[]) => any)
```

You can use it in several ways:

* Memoize a `get` accessor,
* Memoize a method which takes no parameters,
* Memoize a method which varies based on its first parameter only,
* Memoize a method which varies based on some combination of parameters
* Memoize a method using objects with deep equality comparison (default)

You can call memoized methods *within* the same class, too.  This could be useful if you want to memoize the return value for an entire data set, and also a filtered or mapped version of that same set.

## Memoize a `get` accessor, or a method which takes no parameters

These both work the same way. Subsequent calls to a memoized method without parameters, or to a `get` accessor, always return the same value.

I generally consider it an anti-pattern for a call to a `get` accessor to trigger an expensive operation.  Simply adding `Memoize()` to a `get` allows for seamless lazy-loading.

```typescript
import {Memoize,MemoizeExpiring} from 'typescript-memoize';

class SimpleFoo {

    // Memoize a method without parameters
    @Memoize()
    public getAllTheData() {
       // do some expensive operation to get data
       return data;
    }

    // Memoize a method and expire the value after some time in milliseconds
    @MemoizeExpiring(5000)
    public getDataForSomeTime() {
        // do some expensive operation to get data
        return data;
    }

    // Memoize a getter
    @Memoize()
    public get someValue() {
        // do some expensive operation to calculate value
        return value;
    }

}
```

And then we call them from somewhere else in our code:

```typescript
let simpleFoo = new SimpleFoo();

// Memoizes a calculated value and returns it:
let methodVal1 = simpleFoo.getAllTheData();

// Returns memoized value
let methodVal2 = simpleFoo.getAllTheData();

// Memoizes (lazy-loads) a calculated value and returns it:
let getterVal1 = simpleFoo.someValue;

// Returns memoized value
let getterVal2 = simpleFoo.someValue;

```

## Memoize a method which varies based on its first parameter only

Subsequent calls to this style of memoized method will always return the same value.

I'm not really sure why anyone would use this approach to memoize a method with *more* than one parameter, but it's possible.

```typescript
import {Memoize} from 'typescript-memoize';

class ComplicatedFoo {

	// Memoize a method without parameters (just like the first example)
	@Memoize()
	public getAllTheData() {
		// do some expensive operation to get data
		return data;
	}

	// Memoize a method with one parameter
	@Memoize()
	public getSomeOfTheData(id: number) {
		let allTheData = this.getAllTheData(); // if you want to!
		// do some expensive operation to get data
		return data;
	}

	// Memoize a method with multiple parameters
	// Only the first parameter will be used for memoization
	@Memoize()
	public getGreeting(name: string, planet: string) {
		return 'Hello, ' + name + '! Welcome to ' + planet;
	}

}
```

We call these methods from somewhere else in our code:

```typescript
let complicatedFoo = new ComplicatedFoo();

// Returns calculated value and memoizes it:
let oneParam1 = complicatedFoo.getSomeOfTheData();

// Returns memoized value
let oneParam2 = complicatedFoo.getSomeOfTheData();

// Memoizes a calculated value and returns it:
// 'Hello, Darryl! Welcome to Earth'
let greeterVal1 = complicatedFoo.getGreeting('Darryl', 'Earth');

// Ignores the second parameter, and returns memoized value
// 'Hello, Darryl! Welcome to Earth'
let greeterVal2 = complicatedFoo.getGreeting('Darryl', 'Mars');
```

## Memoize a method which varies based on some combination of parameters

Pass in a `hashFunction` which takes the same parameters as your target method, to memoize values based on all parameters, or some other custom logic

```typescript
import {Memoize} from 'typescript-memoize';

class MoreComplicatedFoo {

	// Memoize a method with multiple parameters
	// Memoize will remember values based on keys like: 'name;planet'
	@Memoize((name: string, planet: string) => {
		return name + ';' + planet;
	})
	public getBetterGreeting(name: string, planet: string) {
		return 'Hello, ' + name + '! Welcome to ' + planet;
	}
	
	// Memoize based on some other logic
	@Memoize(() => {
		return new Date();
	})
	public memoryLeak(greeting: string) {
		return greeting + '!!!!!';
	}

	// Memoize also accepts parameters via a single object argument
	@Memoize({
		expiring: 10000, // milliseconds
		hashFunction: (name: string, planet: string) => {
			return name + ';' + planet;
		}
	})
	public getSameBetterGreeting(name: string, planet: string) {
		return 'Hello, ' + name + '! Welcome to ' + planet;
	}

}
```

We call these methods from somewhere else in our code.  By now you should be getting the idea:

```typescript
let moreComplicatedFoo = new MoreComplicatedFoo();

// 'Hello, Darryl! Welcome to Earth'
let greeterVal1 = moreComplicatedFoo.getBetterGreeting('Darryl', 'Earth');

// 'Hello, Darryl! Welcome to Mars'
let greeterVal2 = moreComplicatedFoo.getBetterGreeting('Darryl', 'Mars');

// Fill up the computer with useless greetings:
let greeting = moreComplicatedFoo.memoryLeak('Hello');

```

## Memoize accepts one or more "tag" strings that allow the cache to be invalidated on command

Passing an array with one or more "tag" strings these will allow you to later clear the cache of results associated with methods or the `get`accessors using the `clear()` function.

The `clear()` function also requires an array of "tag" strings.

```typescript
import {Memoize} from 'typescript-memoize';

class ClearableFoo {

	// Memoize accepts tags
	@Memoize({ tags: ["foo", "bar"] })
	public getClearableGreeting(name: string, planet: string) {
		return 'Hello, ' + name + '! Welcome to ' + planet;
	}


	// Memoize accepts tags
	@Memoize({ tags: ["bar"] })
	public getClearableSum(a: number, b: number) {
		return a + b;
	}

}
```

We call these methods from somewhere else in our code.

```typescript
import {clear} from 'typescript-memoize';

let clearableFoo = new ClearableFoo();

// 'Hello, Darryl! Welcome to Earth'
let greeterVal1 = clearableFoo.getClearableGreeting('Darryl', 'Earth');

// Ignores the second parameter, and returns memoized value
// 'Hello, Darryl! Welcome to Earth'
let greeterVal2 = clearableFoo.getClearableGreeting('Darryl', 'Mars');

// '3'
let sum1 = clearableFoo.getClearableSum(2, 1);

// Ignores the second parameter, and returns memoized value
// '3'
let sum2 = clearableFoo.getClearableSum(2, 2);

clear(["foo"]);

// The memoized values are cleared, return a new value
// 'Hello, Darryl! Welcome to Mars'
let greeterVal3 = clearableFoo.getClearableGreeting('Darryl', 'Mars');


// The memoized value is not associated with 'foo' tag, returns memoized value
// '3'
let sum3 = clearableFoo.getClearableSum(2, 2);

clear(["bar"]);

// The memoized values are cleared, return a new value
// 'Hello, Darryl! Welcome to Earth'
let greeterVal4 = clearableFoo.getClearableGreeting('Darryl', 'Earth');


// The memoized values are cleared, return a new value
// '4'
let sum4 = clearableFoo.getClearableSum(2, 2);

```

## Memoize with deep equality comparison

By default, memoization now uses deep equality when comparing objects, which is useful for objects and arrays with the same structure but different references. If needed, you can disable deep equality with the `useDeepEqual: false` option:

```typescript
import {Memoize} from 'typescript-memoize';

class DeepEqualityFoo {
    // Uses deep equality comparison by default
    @Memoize()
    public processObject(obj: any) {
        // This will only be called once for objects with the same structure,
        // even if they are different instances
        return expensiveOperation(obj);
    }

    // Disable deep equality if you want reference equality instead
    @Memoize({
        useDeepEqual: false
    })
    public processObjectWithReferenceEquality(obj: any) {
        // This will be called for each new object reference,
        // even if they have the same structure
        return expensiveOperation(obj);
    }

    // Combine with other options
    @Memoize({
        expiring: 5000, // expire after 5 seconds
        tags: ["objects"]
    })
    public processComplexObject(obj: any) {
        return expensiveOperation(obj);
    }
}
```

We can call these methods and get memoized results based on deep equality:

```typescript
let deepFoo = new DeepEqualityFoo();

// First call with an object
const result1 = deepFoo.processObject({ id: 123, name: "Test" });

// Second call with different object instance but same structure
// Will return the memoized result without calling the original method again
const result2 = deepFoo.processObject({ id: 123, name: "Test" });

// Call with different object structure
// Will call the original method again
const result3 = deepFoo.processObject({ id: 456, name: "Different" });

// Deep equality works with complex nested objects too
const result4 = deepFoo.processComplexObject({ 
    user: { 
        id: 123, 
        details: { 
            age: 30, 
            preferences: ["red", "blue"] 
        } 
    }
});

// Using reference equality will call the method for each new object
const refObj = { id: 123, name: "Test" };
const result5 = deepFoo.processObjectWithReferenceEquality(refObj);
// This will be memoized since it's the same reference
const result6 = deepFoo.processObjectWithReferenceEquality(refObj);
// This will call the method again since it's a new reference
const result7 = deepFoo.processObjectWithReferenceEquality({ id: 123, name: "Test" });
```

The deep equality comparison uses the [fast-deep-equal](https://www.npmjs.com/package/fast-deep-equal) package for efficient deep equality comparisons.
