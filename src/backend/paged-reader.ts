import type { FileHandle } from "node:fs/promises";

const DEFAULT_PAGE_SIZE = 16 * 1024;
const DEFAULT_CACHE_PAGES = 64;

export type PagedReaderOptions = {
  pageSize?: number;
  maxCachedPages?: number;
};

/**
 * Small paged reader for repeated random access against a file handle.
 *
 * Pages are cached in insertion order and the oldest page is evicted when the
 * cache grows past `maxCachedPages`.
 */
export class PagedReader {
  private readonly pageSize: number;
  private readonly maxCachedPages: number;
  private readonly cache = new Map<number, Buffer>();
  private readonly handle: FileHandle;
  public constructor(handle: FileHandle, options: PagedReaderOptions = {}) {
    this.handle = handle;
    this.pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    this.maxCachedPages = options.maxCachedPages ?? DEFAULT_CACHE_PAGES;
  }
  public async read(offset: number, length: number): Promise<Buffer> {
    if(length <= 0) {
      return Buffer.alloc(0);
    }

    const startPage = Math.floor(offset / this.pageSize);
    const endPage = Math.floor((offset + length - 1) / this.pageSize);
    const firstPageOffset = offset % this.pageSize;

    if(startPage === endPage) {
      const page = await this.readPage(startPage);
      return page.subarray(firstPageOffset, firstPageOffset + length);
    }

    const buffer = Buffer.allocUnsafe(length);
    let written = 0;

    for(let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
      const page = await this.readPage(pageNumber);
      const sliceStart = pageNumber === startPage ? firstPageOffset : 0;
      const remaining = length - written;
      const sliceEnd = Math.min(page.length, sliceStart + remaining);
      written += page.copy(buffer, written, sliceStart, sliceEnd);
    }

    return buffer;
  }
  public async readByte(offset: number): Promise<number | undefined> {
    if(offset < 0) {
      return undefined;
    }
    const pageNumber = Math.floor(offset / this.pageSize);
    const page = await this.readPage(pageNumber);
    return page[offset % this.pageSize];
  }
  private async readPage(pageNumber: number): Promise<Buffer> {
    const cached = this.cache.get(pageNumber);
    if(cached !== undefined) {
      this.cache.delete(pageNumber);
      this.cache.set(pageNumber, cached);
      return cached;
    }

    const buffer = Buffer.allocUnsafe(this.pageSize);
    const { bytesRead } = await this.handle.read(
      buffer as unknown as Uint8Array,
      0,
      this.pageSize,
      pageNumber * this.pageSize
    );
    const page = bytesRead === this.pageSize ? buffer : buffer.subarray(0, bytesRead);
    this.cache.set(pageNumber, page);

    if(this.cache.size > this.maxCachedPages) {
      const first = this.cache.keys().next();
      if(!first.done) {
        this.cache.delete(first.value);
      }
    }

    return page;
  }
}
