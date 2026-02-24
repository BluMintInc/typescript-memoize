import equal from '@blumintinc/fast-deep-equal';

// Detects class instances with no enumerable properties (e.g., Firestore Transaction,
// WriteBatch). Deep equality cannot meaningfully compare these — it always returns true
// because there are no enumerable keys to diff. Reference equality is strictly more
// correct: "same reference" is a valid identity check, while "always equal" is not.
function isOpaqueClassInstance(obj: unknown): boolean {
	if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) return false;
	const proto = Object.getPrototypeOf(obj);
	// Plain objects ({}) and null-prototype objects (Object.create(null))
	if (proto === null || proto === Object.prototype) return false;
	// Objects whose prototype was created via Object.create({}) — still plain-like
	if (proto.constructor === Object) return false;
	// Known value types that fast-deep-equal handles correctly
	if (obj instanceof Date || obj instanceof RegExp ||
		obj instanceof Map || obj instanceof Set) return false;
	return Object.keys(obj as Record<string, unknown>).length === 0;
}

function containsOpaqueValue(obj: unknown): boolean {
	if (typeof obj !== 'object' || obj === null) return false;
	return Object.values(obj as Record<string, unknown>).some(isOpaqueClassInstance);
}

// Uses reference equality for opaque class instances while preserving deep equality
// for everything else. When no opaque values are present, delegates entirely to
// fast-deep-equal for full edge-case handling (TypedArrays, circular refs, etc.).
function memoizeEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a == null || b == null) return false;
	if (typeof a !== 'object' || typeof b !== 'object') return equal(a, b);

	// Opaque class instances: reference equality (already checked a === b above)
	if (isOpaqueClassInstance(a) || isOpaqueClassInstance(b)) return false;

	// Arrays: element-wise with opaque awareness
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		return a.every((el, i) => memoizeEqual(el, (b as unknown[])[i]));
	}

	// Objects: if no value is opaque, delegate to fast-deep-equal
	if (!containsOpaqueValue(a) && !containsOpaqueValue(b)) {
		return equal(a, b);
	}

	// Recursive property comparison with opaque awareness
	const keysA = Object.keys(a);
	const keysB = Object.keys(b);
	if (keysA.length !== keysB.length) return false;
	return keysA.every(
		key => key in (b as Record<string, unknown>) &&
			memoizeEqual(
				(a as Record<string, unknown>)[key],
				(b as Record<string, unknown>)[key],
			),
	);
}

interface MemoizeArgs {
	expiring?: number;
	hashFunction?: boolean | ((...args: any[]) => any);
	tags?: string[];
	useDeepEqual?: boolean;
}


export function Memoize(args?: MemoizeArgs | MemoizeArgs['hashFunction']) {
	let hashFunction: MemoizeArgs['hashFunction'];
	let duration: MemoizeArgs['expiring'];
	let tags: MemoizeArgs['tags'];
	let useDeepEqual: MemoizeArgs['useDeepEqual'] = true;

	if (typeof args === 'object') {
		hashFunction = args.hashFunction;
		duration = args.expiring;
		tags = args.tags;
		useDeepEqual = args.useDeepEqual ?? true;
	} else {
		hashFunction = args;
	}

	return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
		if (descriptor.value != null) {
			descriptor.value = getNewFunction(descriptor.value, hashFunction, duration, tags, useDeepEqual);
		} else if (descriptor.get != null) {
			descriptor.get = getNewFunction(descriptor.get, hashFunction, duration, tags, useDeepEqual);
		} else {
			throw 'Only put a Memoize() decorator on a method or get accessor.';
		}
	};
}

export function MemoizeExpiring(expiring: number, hashFunction?: MemoizeArgs['hashFunction']) {
	return Memoize({
		expiring,
		hashFunction
	});
}

const clearCacheTagsMap: Map<string, Map<any, any>[]> = new Map();

export function clear (tags: string[]): number {
	const cleared: Set<Map<any, any>> = new Set();
	for (const tag of tags) {
		const maps = clearCacheTagsMap.get(tag);
		if (maps) {
			for (const mp of maps) {
				if (!cleared.has(mp)) {
					mp.clear();
					cleared.add(mp);
				}
			}
		}
	}
	return cleared.size;
}

// A wrapper around Map that uses deep equality for key comparison
class DeepEqualMap<K, V> {
	private map = new Map<string, { key: K, value: V }>();
	
	has(key: K): boolean {
		const entries = Array.from(this.map.values());
		for (const entry of entries) {
			if (memoizeEqual(entry.key, key)) {
				return true;
			}
		}
		return false;
	}
	
	get(key: K): V | undefined {
		const entries = Array.from(this.map.values());
		for (const entry of entries) {
			if (memoizeEqual(entry.key, key)) {
				return entry.value;
			}
		}
		return undefined;
	}
	
	set(key: K, value: V): this {
		const entries = Array.from(this.map.entries());
		for (const [serializedKey, entry] of entries) {
			if (memoizeEqual(entry.key, key)) {
				this.map.delete(serializedKey);
				break;
			}
		}
		
		const serializedKey = `${Date.now()}_${Math.random()}`;
		this.map.set(serializedKey, { key, value });
		return this;
	}
	
	clear(): void {
		this.map.clear();
	}
}

function getNewFunction(
	originalMethod: () => void, 
	hashFunction?: MemoizeArgs['hashFunction'], 
	duration: number = 0, 
	tags?: MemoizeArgs['tags'],
	useDeepEqual: boolean = true
) {
	const propMapName = Symbol(`__memoized_map__`);
	const propDeepMapName = Symbol(`__memoized_deep_map__`);

	// The function returned here gets called instead of originalMethod.
	return function (...args: any[]) {
		let returnedValue: any;

		// Get or create appropriate map based on deep equality requirement
		if (useDeepEqual) {
			if (!this.hasOwnProperty(propDeepMapName)) {
				Object.defineProperty(this, propDeepMapName, {
					configurable: false,
					enumerable: false,
					writable: false,
					value: new DeepEqualMap<any, any>()
				});
			}
			let myMap: DeepEqualMap<any, any> = this[propDeepMapName];
			
			if (Array.isArray(tags)) {
				for (const tag of tags) {
					// Since DeepEqualMap doesn't match the Map interface exactly,
					// we wrap it in a Map for tag clearing purposes
					const mapWrapper = {
						clear: () => myMap.clear()
					} as any;
					
					if (clearCacheTagsMap.has(tag)) {
						clearCacheTagsMap.get(tag).push(mapWrapper);
					} else {
						clearCacheTagsMap.set(tag, [mapWrapper]);
					}
				}
			}
			
			let hashKey: any;
			
			// If true is passed as first parameter, will automatically use every argument
			if (hashFunction === true) {
				hashKey = args;
			} else if (hashFunction) {
				hashKey = hashFunction.apply(this, args);
			} else if (args.length > 0) {
				hashKey = args.length === 1 ? args[0] : args;
			} else {
				hashKey = this;
			}
			
			// Handle expiration
			const timestampKey = { __timestamp: true, key: hashKey };
			let isExpired: boolean = false;
			
			if (duration > 0) {
				if (!myMap.has(timestampKey)) {
					isExpired = true;
				} else {
					let timestamp = myMap.get(timestampKey);
					isExpired = (Date.now() - timestamp) > duration;
				}
			}
			
			if (myMap.has(hashKey) && !isExpired) {
				returnedValue = myMap.get(hashKey);
			} else {
				returnedValue = originalMethod.apply(this, args);
				myMap.set(hashKey, returnedValue);
				if (duration > 0) {
					myMap.set(timestampKey, Date.now());
				}
			}
		} else {
			// Original implementation with standard Map (shallow equality)
			if (!this.hasOwnProperty(propMapName)) {
				Object.defineProperty(this, propMapName, {
					configurable: false,
					enumerable: false,
					writable: false,
					value: new Map<any, any>()
				});
			}
			let myMap: Map<any, any> = this[propMapName];

			if (Array.isArray(tags)) {
				for (const tag of tags) {
					if (clearCacheTagsMap.has(tag)) {
						clearCacheTagsMap.get(tag).push(myMap);
					} else {
						clearCacheTagsMap.set(tag, [myMap]);
					}
				}
			}

			if (hashFunction || args.length > 0 || duration > 0) {
				let hashKey: any;

				// If true is passed as first parameter, will automatically use every argument, passed to string
				if (hashFunction === true) {
					hashKey = args.map(a => a.toString()).join('!');
				} else if (hashFunction) {
					hashKey = hashFunction.apply(this, args);
				} else {
					hashKey = args[0];
				}

				const timestampKey = `${hashKey}__timestamp`;
				let isExpired: boolean = false;
				if (duration > 0) {
					if (!myMap.has(timestampKey)) {
						// "Expired" since it was never called before
						isExpired = true;
					} else {
						let timestamp = myMap.get(timestampKey);
						isExpired = (Date.now() - timestamp) > duration;
					}
				}

				if (myMap.has(hashKey) && !isExpired) {
					returnedValue = myMap.get(hashKey);
				} else {
					returnedValue = originalMethod.apply(this, args);
					myMap.set(hashKey, returnedValue);
					if (duration > 0) {
						myMap.set(timestampKey, Date.now());
					}
				}

			} else {
				const hashKey = this;
				if (myMap.has(hashKey)) {
					returnedValue = myMap.get(hashKey);
				} else {
					returnedValue = originalMethod.apply(this, args);
					myMap.set(hashKey, returnedValue);
				}
			}
		}

		return returnedValue;
	};
}
