export interface LRUCache<T, V> {
	get(element: T): V;
	print(): void;
}

// Generic LRUCache generator If an element already exists based on key collision,
// the existing element is returned. Otherwise, a new element is allocated and
// valueFn is called with the allocated slot Id.
//
// If the LRUCache is filled, the least-recently used element is removed and the
// new element is inserted.
//
// Args:
//   @capacity (int):                   - Max number of elements to store in
//                                        the cache.
//   @keyFn    (elem) -> string:        - Function to extract a unique key for
//                                        identifying elements in the cache.
//   @valueFn  (elem, slotId) -> any:   - Function to extract the value from an
//                                        element. Only called on insertion.
//                                        If async, the result of get() must be awaited.
//   @deleteFn (key, value) -> void:    - Function that is called when popping an
//                                        element from the cache, if specified.
//                                        If async, the result of get() must be awaited.
export function NewLRUCache<T, V>(
	capacity: number,
	keyFn: (elem: T) => string,
	valueFn: (elem: T, slotId: number) => V,
	deleteFn?: (key: string, value: V) => any,
): LRUCache<T, V> {
	const t = {
		slots: {} as Record<string, any>, // Maps a key to its position in the queue.
		// elements are of shape {prev, next, key, value}
		lruFront: null as string | null, // Push onto the front
		lruBack: null as string | null, // pop off the back
		occupancy: 0, // The number of elements currently in the cache.

		// Gets an element from the cache. If the element is already present in the
		// cache, the existing version is returned.
		get(element: T): V {
			return t._get(element, valueFn);
		},

		_get(element: T, valFn: (elem: T, slotId: number) => V): V {
			const key = keyFn(element);
			if (key in t.slots) {
				// Move the requested slot to the front of the queue.
				const slot = t.slots[key];
				if (slot.prev) {
					t.slots[slot.prev].next = slot.next;
				}
				if (slot.next) {
					t.slots[slot.next].prev = slot.prev;
				}
				t.slots[t.lruFront!].prev = key;
				slot.next = t.lruFront;
				slot.prev = null;
				t.lruFront = key;
				return slot.value;
			}

			// Insert at the front
			if (t.occupancy < capacity) {
				const slot = {
					prev: null,
					next: t.lruFront,
					key: key,
					value: valFn(element, t.occupancy),
				};
				if (t.lruFront) {
					t.slots[t.lruFront].prev = key;
				}
				if (!t.lruBack) {
					t.lruBack = key;
				}
				t.slots[key] = slot;
				t.occupancy += 1;
				t.lruFront = key;
				return slot.value;
			}

			// Pop the back
			const back = t.slots[t.lruBack!];
			if (deleteFn) {
				deleteFn(back.key, back.value);
			}
			if (back.prev) {
				t.slots[back.prev].next = null;
			}
			delete t.slots[t.lruBack!];
			t.lruBack = back.prev;
			t.occupancy -= 1;

			const deleteThenValue = (elem: T, slotId: number) => {
				if (deleteFn) {
					const deleted = deleteFn(back.key, back.value);
					if (deleted) {
						// Means it was a promise
						return deleted.then(() => valueFn(elem, slotId));
					}
				}
				return valueFn(elem, slotId);
			};

			// Element has been removed, so now call again to insert.
			return t._get(element, deleteThenValue);
		},

		print(): void {
			if (!t.lruFront) {
				return;
			}
			const elems = [];
			let rover = t.lruFront;
			while (rover) {
				elems.push(t.slots[rover].key);
				rover = t.slots[rover].next;
			}
			console.log("LINKS", elems.join(" -> "));
		},
	};

	return t;
}
