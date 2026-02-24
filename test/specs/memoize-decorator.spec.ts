import { clear, Memoize, MemoizeExpiring } from '../../src/memoize-decorator';
import exp = require('constants');

describe('Memoize()', () => {

	// Doing spies a little unusually because the decorator under test does things
	// to the originl methods below.  I figure it's better to be explicit here…
	let getNumberSpy = jasmine.createSpy('getNumberSpy');
	let valueSpy = jasmine.createSpy('valueSpy');
	let getGreetingSpy = jasmine.createSpy('getGreetingSpy');
	let multiplySpy = jasmine.createSpy('multiplySpy');
	let deepEqualSpy = jasmine.createSpy('deepEqualSpy');

	let a: MyClass;
	let b: MyClass;

	beforeEach(() => {
		a = new MyClass();
	    b = new MyClass();

		getNumberSpy.calls.reset();
		valueSpy.calls.reset();
		getGreetingSpy.calls.reset();
		multiplySpy.calls.reset();
		deepEqualSpy.calls.reset();
	});
	class MyClass {
		@Memoize()
		public getNumber(): number {
			getNumberSpy();
			return Math.random();
		}

		@Memoize()
		public get value(): number {
			//valueSpy();
			return Math.random();
		}

		@Memoize()
		public getGreeting(greeting: string, planet: string): string {
			getGreetingSpy.apply(this, arguments);
			return greeting + ', ' + planet;
		}

		@Memoize((a: number, b: number) => {
			return a + ';' + b;
		})
		public multiply(a: number, b: number) {
			multiplySpy.apply(this, arguments);
			return a * b;
		}

		@Memoize(true)
		public multiply2(a: number, b: number) {
			multiplySpy.apply(this, arguments);
			return a * b;
		}

		@Memoize(true)
		public getGreeting2(greeting: string, planet: string): string {
			getGreetingSpy.apply(this, arguments);
			return greeting + ', ' + planet;
		}

		@Memoize({
			hashFunction: (a: number, b: number) => {
				return a + ';' + b;
			}
		})
		public multiply3(a: number, b: number) {
			multiplySpy.apply(this, arguments);
			return a * b;
		}

		@Memoize({
			hashFunction: true
		})
		public getGreeting3(greeting: string, planet: string): string {
			getGreetingSpy.apply(this, arguments);
			return greeting + ', ' + planet;
		}

		@Memoize({
			hashFunction: true,
			tags: ["foo", "bar"]
		})
		public getGreeting4(greeting: string, planet: string): string {
			getGreetingSpy.apply(this, arguments);
			return greeting + ', ' + planet;
		}

		@Memoize({
			useDeepEqual: true
		})
		public processObject(obj: any): string {
			deepEqualSpy(obj);
			return JSON.stringify(obj);
		}

		@Memoize({
			useDeepEqual: true,
			expiring: 100
		})
		public processArrayDeep(arr: any[]): string {
			deepEqualSpy(arr);
			return JSON.stringify(arr);
		}

		@Memoize({
			useDeepEqual: false
		})
		public getGreetingShallow(greeting: string, planet: string): string {
			getGreetingSpy.apply(this, arguments);
			return greeting + ', ' + planet;
		}

		@Memoize({
			useDeepEqual: false
		})
		public getNumberShallow(): number {
			getNumberSpy();
			return Math.random();
		}

		@Memoize({
			useDeepEqual: false,
			expiring: 100
		})
		public getExpiringShallow(key: string): string {
			getGreetingSpy();
			return key + '_' + Math.random();
		}

		@Memoize({
			useDeepEqual: false,
			tags: ['shallowTag']
		})
		public getTaggedShallow(key: string): string {
			getGreetingSpy();
			return key + '_' + Math.random();
		}
	}

	describe('when it is used in a bad way', () => {
		it("method throw an exception", () => {
			let err: Error;
			try {
				const fn = Memoize(true) as any;
				fn();
			} catch(e) {
				err = e;
			}
			expect(err).toBeInstanceOf(Error);
	    });
	});

	describe('when decorating a method', () => {
		it("method should be memoized", () => {
			expect(a.getNumber()).toEqual(a.getNumber());
	    });

		it("multiple instances shouldn't share values for methods", () => {
			expect(a.getNumber()).not.toEqual(b.getNumber());
	    });
	});

	describe('when decorating a get accessor', () => {
		it("accessor should be memoized", () => {
			expect(a.value).toEqual(a.value);
	    });

		it("multiple instances shouldn't share values for accessors", () => {
			expect(a.value).not.toEqual(b.value);
	    });
	});

	describe('when decorating a method, which takes some parameters', () => {
		it('should call the original method with the original arguments', () => {
			let val1 = a.getGreeting('Halló', 'heimur'); // In Icelandic
			expect(val1).toEqual('Halló, heimur');
			expect(getGreetingSpy).toHaveBeenCalledWith('Halló', 'heimur');
		});

		it('should call the original method once', () => {
			let val1 = a.getGreeting('Ciao', 'mondo'); // In Italian
			let val2 = a.getGreeting('Ciao', 'mondo');

			expect(val1).toEqual('Ciao, mondo');
			expect(val2).toEqual('Ciao, mondo');

			expect(getGreetingSpy).toHaveBeenCalledTimes(1);
		});

		it('should not share between two instances of the same class', () => {
			let val1 = a.getGreeting('Hej', 'världen'); // In Swedish
			let val2 = b.getGreeting('Hej', 'världen');

			expect(val1).toEqual('Hej, världen');
			expect(val2).toEqual('Hej, världen');

			expect(getGreetingSpy).toHaveBeenCalledTimes(2);
		})

		it('should call the original method once, even if the second parameter is different', () => {
			let val1 = a.getGreetingShallow('Hola', 'Mundo'); // Spanish, even
			let val2 = a.getGreetingShallow('Hola', 'Mars');

			expect(val1).toEqual('Hola, Mundo');
			expect(val2).toEqual('Hola, Mundo');

			expect(getGreetingSpy).toHaveBeenCalledTimes(1);
		});

		it('should consider all parameters with deep equality by default', () => {
			let val1 = a.getGreeting('Hola', 'Mundo');
			let val2 = a.getGreeting('Hola', 'Mars');

			expect(val1).toEqual('Hola, Mundo');
			expect(val2).toEqual('Hola, Mars'); // Different result with deep equality

			expect(getGreetingSpy).toHaveBeenCalledTimes(2);
		});

		it('should call the original method once', () => {
			let val1 = a.getGreeting('Bonjour', 'le monde');
			let val2 = a.getGreeting('Hello', 'World');

			expect(val1).toEqual('Bonjour, le monde');
			expect(val2).toEqual('Hello, World');

			expect(getGreetingSpy).toHaveBeenCalledTimes(2);
		});

		it('should memoize shallow no-arg method', () => {
			let val1 = a.getNumberShallow();
			let val2 = a.getNumberShallow();
			expect(val1).toEqual(val2);
			expect(getNumberSpy).toHaveBeenCalledTimes(1);
		});

		it('should expire shallow equality cache after duration', (done) => {
			let val1 = a.getExpiringShallow('key');

			setTimeout(() => {
				let val2 = a.getExpiringShallow('key');
				expect(val1).toEqual(val2);
				expect(getGreetingSpy).toHaveBeenCalledTimes(1);

				setTimeout(() => {
					let val3 = a.getExpiringShallow('key');
					expect(getGreetingSpy).toHaveBeenCalledTimes(2);
					done();
				}, 70);
			}, 50);
		});

		it('should clear shallow tagged cache', () => {
			let val1 = a.getTaggedShallow('x');
			let val2 = a.getTaggedShallow('x');
			expect(val1).toEqual(val2);
			expect(getGreetingSpy).toHaveBeenCalledTimes(1);

			clear(['shallowTag']);
			let val3 = a.getTaggedShallow('x');
			expect(getGreetingSpy).toHaveBeenCalledTimes(2);
		});
	});


	describe('when decorating a method using a hashFunction', () => {

		it('should call the original method with the original arguments', () => {
			let val1 = a.multiply(5, 7);
			expect(multiplySpy).toHaveBeenCalledWith(5, 7);
		});

		it('should only call the original method once', () => {
			let val1 = a.multiply(4, 6);
			let val2 = a.multiply(4, 6);
			expect(val1).toEqual(24);
			expect(val2).toEqual(24);
			expect(multiplySpy.calls.count()).toEqual(1);
		});

		it('should not simply memoize based on the first parameter', () => {
			let val1 = a.multiply(4, 7);
			let val2 = a.multiply(4, 9);
			expect(val1).toEqual(28);
			expect(val2).toEqual(36);
			expect(multiplySpy.calls.count()).toEqual(2);
		});
	});

	describe('when passing true to memoize as a hashFunction', () => {
		it('should call the original method with the original arguments', () => {
			let val1 = a.multiply2(5, 7);
			expect(multiplySpy).toHaveBeenCalledWith(5, 7);
		});

		it('should only call the original method once', () => {
			let val1 = a.multiply2(4, 6);
			let val2 = a.multiply2(4, 6);
			expect(val1).toEqual(24);
			expect(val2).toEqual(24);
			expect(multiplySpy.calls.count()).toEqual(1);
		});


		it('should take into consideration every parameter', () => {
			let val1 = a.getGreeting2('Hello', 'World');
			let val2 = a.getGreeting2('Hello', 'Moon');

			expect(val1).toEqual('Hello, World');
			expect(val2).toEqual('Hello, Moon');

			expect(getGreetingSpy).toHaveBeenCalledTimes(2);
		});

	});

	describe('when passing arguments as arguments object', () => {
		it('should call the original method with the original arguments', () => {
			let val1 = a.multiply3(5, 7);
			expect(multiplySpy).toHaveBeenCalledWith(5, 7);
		});

		it('should only call the original method once', () => {
			let val1 = a.multiply3(4, 6);
			let val2 = a.multiply3(4, 6);
			expect(val1).toEqual(24);
			expect(val2).toEqual(24);
			expect(multiplySpy.calls.count()).toEqual(1);
		});

		it('should take into consideration every parameter', () => {
			let val1 = a.getGreeting3('Hello', 'World');
			let val2 = a.getGreeting3('Hello', 'Moon');

			expect(val1).toEqual('Hello, World');
			expect(val2).toEqual('Hello, Moon');

			expect(getGreetingSpy).toHaveBeenCalledTimes(2);
		});

		it('should be cleared ', () => {
			let val1 = a.getGreeting4('Hello', 'World');
			let val2 = a.getGreeting4('Hello', 'Moon');
			let val3 = a.getGreeting4('Hello', 'World');
			clear(["foo"]);
			let val4 = a.getGreeting4('Hello', 'Moon');
			let val5 = a.getGreeting4('Hello', 'World');
			clear(["bar"]);
			let val6 = a.getGreeting4('Hello', 'World');

			clear(["unknown"]);

			expect(val1).toEqual('Hello, World');
			expect(val2).toEqual('Hello, Moon');
			expect(val3).toEqual('Hello, World');
			expect(val4).toEqual('Hello, Moon');
			expect(val5).toEqual('Hello, World');
			expect(val6).toEqual('Hello, World');

			expect(getGreetingSpy).toHaveBeenCalledTimes(5);
		});

	});

	describe('when using opaque class instances', () => {
		let opaqueCallSpy = jasmine.createSpy('opaqueCallSpy');

		// Simulates Firestore Transaction: a class instance with zero enumerable
		// properties. All internal state is non-enumerable, just like native bindings.
		class OpaqueInstance {
			constructor() {
				Object.defineProperty(this, '_id', {
					value: Symbol(),
					enumerable: false,
					writable: false,
				});
			}
		}

		class OpaqueTestClass {
			@Memoize()
			public process(scope: OpaqueInstance): number {
				opaqueCallSpy();
				return Math.random();
			}

			@Memoize()
			public processWithProps(props: { id: string; scope: OpaqueInstance }): number {
				opaqueCallSpy();
				return Math.random();
			}

			@Memoize(true)
			public processMulti(id: string, scope: OpaqueInstance): number {
				opaqueCallSpy();
				return Math.random();
			}
		}

		let instance: OpaqueTestClass;

		beforeEach(() => {
			instance = new OpaqueTestClass();
			opaqueCallSpy.calls.reset();
		});

		it('should use reference equality for opaque class instances', () => {
			const scope1 = new OpaqueInstance();
			const scope2 = new OpaqueInstance();

			instance.process(scope1);
			expect(opaqueCallSpy).toHaveBeenCalledTimes(1);

			// Different opaque instance -> cache miss -> re-executes
			instance.process(scope2);
			expect(opaqueCallSpy).toHaveBeenCalledTimes(2);
		});

		it('should cache hit for the same opaque instance', () => {
			const scope = new OpaqueInstance();

			instance.process(scope);
			expect(opaqueCallSpy).toHaveBeenCalledTimes(1);

			// Same opaque instance -> cache hit
			instance.process(scope);
			expect(opaqueCallSpy).toHaveBeenCalledTimes(1);
		});

		it('should detect opaque instances inside object properties', () => {
			const scope1 = new OpaqueInstance();
			const scope2 = new OpaqueInstance();

			instance.processWithProps({ id: 'x', scope: scope1 });
			expect(opaqueCallSpy).toHaveBeenCalledTimes(1);

			// Same id but different opaque scope -> cache miss
			instance.processWithProps({ id: 'x', scope: scope2 });
			expect(opaqueCallSpy).toHaveBeenCalledTimes(2);
		});

		it('should detect opaque instances in multi-arg methods', () => {
			const scope1 = new OpaqueInstance();
			const scope2 = new OpaqueInstance();

			instance.processMulti('userId', scope1);
			expect(opaqueCallSpy).toHaveBeenCalledTimes(1);

			// Same id but different opaque scope -> cache miss
			instance.processMulti('userId', scope2);
			expect(opaqueCallSpy).toHaveBeenCalledTimes(2);
		});

		it('should still use deep equality for plain empty objects', () => {
			const plainSpy = jasmine.createSpy('plainSpy');

			class PlainTestClass {
				@Memoize()
				public process(obj: any): number {
					plainSpy();
					return Math.random();
				}
			}

			const plainInstance = new PlainTestClass();

			plainInstance.process({});
			expect(plainSpy).toHaveBeenCalledTimes(1);

			// Different empty plain object reference -> still cache hit (deep equal)
			plainInstance.process({});
			expect(plainSpy).toHaveBeenCalledTimes(1);
		});

		it('should still use deep equality for Object.create({}) instances', () => {
			const createSpy = jasmine.createSpy('createSpy');

			class CreateTestClass {
				@Memoize()
				public process(obj: any): number {
					createSpy();
					return Math.random();
				}
			}

			const createInstance = new CreateTestClass();

			createInstance.process(Object.create({}));
			expect(createSpy).toHaveBeenCalledTimes(1);

			// Different Object.create({}) reference -> still cache hit (deep equal)
			createInstance.process(Object.create({}));
			expect(createSpy).toHaveBeenCalledTimes(1);
		});

		it('should use deep equality for Date instances (not opaque)', () => {
			const dateSpy = jasmine.createSpy('dateSpy');

			class DateTestClass {
				@Memoize()
				public process(d: Date): number {
					dateSpy();
					return Math.random();
				}
			}

			const dateInstance = new DateTestClass();

			dateInstance.process(new Date(1000));
			expect(dateSpy).toHaveBeenCalledTimes(1);

			// Same date value, different reference -> cache hit (deep equal)
			dateInstance.process(new Date(1000));
			expect(dateSpy).toHaveBeenCalledTimes(1);

			// Different date value -> cache miss
			dateInstance.process(new Date(2000));
			expect(dateSpy).toHaveBeenCalledTimes(2);
		});

		it('should use deep equality for RegExp instances (not opaque)', () => {
			const regexpSpy = jasmine.createSpy('regexpSpy');

			class RegExpTestClass {
				@Memoize()
				public process(r: RegExp): number {
					regexpSpy();
					return Math.random();
				}
			}

			const regexpInstance = new RegExpTestClass();

			regexpInstance.process(/test/g);
			expect(regexpSpy).toHaveBeenCalledTimes(1);

			// Same pattern, different reference -> cache hit
			regexpInstance.process(/test/g);
			expect(regexpSpy).toHaveBeenCalledTimes(1);
		});

		it('should handle null and undefined arguments correctly', () => {
			const nullSpy = jasmine.createSpy('nullSpy');

			class NullTestClass {
				@Memoize()
				public process(val: any): number {
					nullSpy();
					return Math.random();
				}
			}

			const nullInstance = new NullTestClass();

			nullInstance.process(null);
			expect(nullSpy).toHaveBeenCalledTimes(1);

			// Same null -> cache hit
			nullInstance.process(null);
			expect(nullSpy).toHaveBeenCalledTimes(1);
		});

		it('should handle mixed opaque and non-opaque in array args', () => {
			const mixedSpy = jasmine.createSpy('mixedSpy');

			class MixedArrayTestClass {
				@Memoize(true)
				public process(id: string, data: { count: number }, scope: OpaqueInstance): number {
					mixedSpy();
					return Math.random();
				}
			}

			const mixedInstance = new MixedArrayTestClass();
			const scope1 = new OpaqueInstance();
			const scope2 = new OpaqueInstance();

			mixedInstance.process('a', { count: 1 }, scope1);
			expect(mixedSpy).toHaveBeenCalledTimes(1);

			// Same data, same scope -> cache hit
			mixedInstance.process('a', { count: 1 }, scope1);
			expect(mixedSpy).toHaveBeenCalledTimes(1);

			// Same data, different scope -> cache miss
			mixedInstance.process('a', { count: 1 }, scope2);
			expect(mixedSpy).toHaveBeenCalledTimes(2);

			// Different data, same scope -> cache miss
			mixedInstance.process('a', { count: 2 }, scope1);
			expect(mixedSpy).toHaveBeenCalledTimes(3);
		});

		it('should handle objects with different keys as different', () => {
			const keysSpy = jasmine.createSpy('keysSpy');
			const scope = new OpaqueInstance();

			class KeysTestClass {
				@Memoize()
				public process(obj: any): number {
					keysSpy();
					return Math.random();
				}
			}

			const keysInstance = new KeysTestClass();

			keysInstance.process({ id: 'x', scope: scope });
			expect(keysSpy).toHaveBeenCalledTimes(1);

			// Different key count -> cache miss
			keysInstance.process({ id: 'x', scope: scope, extra: true });
			expect(keysSpy).toHaveBeenCalledTimes(2);
		});

		it('should use deep equality for Map instances (not opaque)', () => {
			const mapSpy = jasmine.createSpy('mapSpy');

			class MapTestClass {
				@Memoize()
				public process(m: Map<string, number>): number {
					mapSpy();
					return Math.random();
				}
			}

			const mapInstance = new MapTestClass();
			const m1 = new Map([['a', 1]]);
			const m2 = new Map([['a', 1]]);

			mapInstance.process(m1);
			expect(mapSpy).toHaveBeenCalledTimes(1);

			// Same content, different reference -> cache hit (deep equal)
			mapInstance.process(m2);
			expect(mapSpy).toHaveBeenCalledTimes(1);
		});

		it('should handle arrays with different lengths', () => {
			const arrSpy = jasmine.createSpy('arrSpy');
			const scope1 = new OpaqueInstance();
			const scope2 = new OpaqueInstance();

			class ArrayLenTestClass {
				@Memoize(true)
				public process(a: string, b?: OpaqueInstance): number {
					arrSpy();
					return Math.random();
				}
			}

			const arrInstance = new ArrayLenTestClass();

			arrInstance.process('x', scope1);
			expect(arrSpy).toHaveBeenCalledTimes(1);

			// Different args length -> cache miss
			arrInstance.process('x');
			expect(arrSpy).toHaveBeenCalledTimes(2);
		});

		it('should handle opaque instance compared to non-opaque', () => {
			const mixSpy = jasmine.createSpy('mixSpy');

			class MixTypeTestClass {
				@Memoize()
				public process(val: any): number {
					mixSpy();
					return Math.random();
				}
			}

			const mixInstance = new MixTypeTestClass();

			mixInstance.process(new OpaqueInstance());
			expect(mixSpy).toHaveBeenCalledTimes(1);

			// Plain object vs opaque -> cache miss
			mixInstance.process({ name: 'test' });
			expect(mixSpy).toHaveBeenCalledTimes(2);
		});

		it('should use deep equality for objects with same opaque reference', () => {
			const sameRefSpy = jasmine.createSpy('sameRefSpy');
			const sharedScope = new OpaqueInstance();

			class SameRefTestClass {
				@Memoize()
				public process(props: { id: string; scope: OpaqueInstance }): number {
					sameRefSpy();
					return Math.random();
				}
			}

			const sameRefInstance = new SameRefTestClass();

			sameRefInstance.process({ id: 'a', scope: sharedScope });
			expect(sameRefSpy).toHaveBeenCalledTimes(1);

			// Same opaque ref, same id -> cache hit
			sameRefInstance.process({ id: 'a', scope: sharedScope });
			expect(sameRefSpy).toHaveBeenCalledTimes(1);

			// Same opaque ref, different id -> cache miss
			sameRefInstance.process({ id: 'b', scope: sharedScope });
			expect(sameRefSpy).toHaveBeenCalledTimes(2);
		});
	});

	describe('when using deep equality', () => {
		it('should call the original method with the original arguments', () => {
			const obj = { name: 'Test', age: 25 };
			const result = a.processObject(obj);
			expect(deepEqualSpy).toHaveBeenCalledWith(obj);
			expect(result).toEqual(JSON.stringify(obj));
		});

		it('should memoize based on deep equality, not reference equality', () => {
			// First call with an object
			const obj1 = { name: 'Test', age: 25 };
			const result1 = a.processObject(obj1);
			
			// Second call with different object instance but same content
			const obj2 = { name: 'Test', age: 25 };
			const result2 = a.processObject(obj2);
			
			expect(obj1).not.toBe(obj2); // Different references
			expect(result1).toEqual(result2);
			expect(deepEqualSpy).toHaveBeenCalledTimes(1); // Only called once
		});

		it('should recognize different objects as different keys', () => {
			const obj1 = { name: 'Test', age: 25 };
			const result1 = a.processObject(obj1);
			
			const obj2 = { name: 'Test', age: 30 }; // Different age
			const result2 = a.processObject(obj2);
			
			expect(result1).not.toEqual(result2);
			expect(deepEqualSpy).toHaveBeenCalledTimes(2); // Called twice for different objects
		});

		it('should handle nested objects correctly', () => {
			const obj1 = { user: { name: 'Test', details: { age: 25 } } };
			const result1 = a.processObject(obj1);
			
			const obj2 = { user: { name: 'Test', details: { age: 25 } } };
			const result2 = a.processObject(obj2);
			
			expect(result1).toEqual(result2);
			expect(deepEqualSpy).toHaveBeenCalledTimes(1);
		});

		it('should handle arrays correctly', () => {
			const arr1 = [1, 2, { name: 'Test' }];
			const result1 = a.processArrayDeep(arr1);
			
			const arr2 = [1, 2, { name: 'Test' }];
			const result2 = a.processArrayDeep(arr2);
			
			expect(result1).toEqual(result2);
			expect(deepEqualSpy).toHaveBeenCalledTimes(1);
		});

		it('should expire deep equality cache after duration', (done) => {
			const arr = [1, 2, { name: 'Test' }];
			const result1 = a.processArrayDeep(arr);
			
			setTimeout(() => {
				const result2 = a.processArrayDeep(arr);
				expect(deepEqualSpy).toHaveBeenCalledTimes(1);
				expect(result1).toEqual(result2);
				
				setTimeout(() => {
					const result3 = a.processArrayDeep(arr);
					expect(deepEqualSpy).toHaveBeenCalledTimes(2);
					expect(result1).toEqual(result3); // Values are the same
					done();
				}, 70);
			}, 50);
		});
	});

});


describe('MemoizeExpiring()', () => {

	let getNumberSpy = jasmine.createSpy('getNumberSpy');
	let valueSpy = jasmine.createSpy('valueSpy');

	let a: MyClass;
	let b: MyClass;

	beforeEach(() => {
		a = new MyClass();
		b = new MyClass();

		getNumberSpy.calls.reset();
		valueSpy.calls.reset();
	});

	class MyClass {
		@MemoizeExpiring(100)
		public getNumber(): number {
			getNumberSpy();
			return Math.random();
		}

		@MemoizeExpiring(100)
		public get value(): number {
			//valueSpy();
			return Math.random();
		}
	}


	describe('when decorating a method', () => {
		it("method should be memoized", () => {
			expect(a.getNumber()).toEqual(a.getNumber());
		});

		it("multiple instances shouldn't share values for methods", () => {
			expect(a.getNumber()).not.toEqual(b.getNumber());
		});

		it("should expire memoized values after 100ms", (done) => {
			let an0 = a.getNumber();
			setTimeout(() => {
				let an1 = a.getNumber();
				expect(an0).toEqual(an1);
			}, 20);
			setTimeout(() => {
				let an2 = a.getNumber();
				expect(an0).not.toEqual(an2);
				done();
			}, 120);
		});
	});

	describe('when decorating a get accessor', () => {
		it("accessor should be memoized", () => {
			expect(a.value).toEqual(a.value);
		});

		it("multiple instances shouldn't share values for accessors", () => {
			expect(a.value).not.toEqual(b.value);
		});
	});


});
