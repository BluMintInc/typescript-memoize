const equal = require('fast-deep-equal');

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
	let useDeepEqual: MemoizeArgs['useDeepEqual'] = false;

	if (typeof args === 'object') {
		hashFunction = args.hashFunction;
		duration = args.expiring;
		tags = args.tags;
		useDeepEqual = args.useDeepEqual ?? false;
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
			if (equal(entry.key, key)) {
				return true;
			}
		}
		return false;
	}
	
	get(key: K): V | undefined {
		const entries = Array.from(this.map.values());
		for (const entry of entries) {
			if (equal(entry.key, key)) {
				return entry.value;
			}
		}
		return undefined;
	}
	
	set(key: K, value: V): this {
		const entries = Array.from(this.map.entries());
		for (const [serializedKey, entry] of entries) {
			if (equal(entry.key, key)) {
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
	useDeepEqual: boolean = false
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
