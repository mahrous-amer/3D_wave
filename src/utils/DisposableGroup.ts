interface Disposable {
  dispose(): void;
}

/**
 * Tracks disposable resources and disposes them all at once.
 */
export class DisposableGroup {
  private items: Disposable[] = [];

  add(item: Disposable): void {
    this.items.push(item);
  }

  dispose(): void {
    for (const item of this.items) {
      item.dispose();
    }
    this.items = [];
  }
}
