export type ParsedType<A> = A extends {
    Parser: () => Generator;
} ? ParsedTypeForClass<A> : A extends (...args: unknown[]) => unknown ? ParsedTypeForFunction<A> : never;
type ParsedTypeForFunction<F extends (...args: unknown[]) => unknown> = ReturnType<F> extends Generator<unknown, infer Y> ? Y : never;
type ParsedTypeForClass<C extends {
    Parser: () => Generator;
}> = ReturnType<C["Parser"]> extends Generator<unknown, infer Y> ? Y : never;
export type ParseItem<Result = unknown> = string | RegExp | Iterable<ParseItem> | (() => Generator<ParseItem, Result, unknown>);
export type ParseYieldable<Result = unknown> = ParseItem<Result>;
export interface ParseError {
    iterationCount: number;
    yielded: ParseItem | Error;
    nested?: Array<ParseError>;
}
export type ParseResult<Result> = {
    success: false;
    remaining: string;
    failedOn: ParseError;
} | {
    success: true;
    remaining: string;
    result: Result;
};
export type ParseYieldedValue<Input extends ParseItem> = Input extends RegExp ? RegExpMatchArray : string;
export type ParseGenerator<Result = unknown> = Generator<ParseItem<unknown>, Result, string | RegExpMatchArray> | Generator<ParseItem<unknown>, Result, unknown> | Generator<unknown, Result, undefined> | Iterable<ParseItem>;
export declare function parse<Result = void>(input: string, iterable: ParseGenerator<Result>): ParseResult<Result>;
export declare function mustEnd(): Generator<RegExp, void, unknown>;
export declare function isEnd(): Generator<RegExp, boolean, {
    index: number;
}>;
export declare function hasMore(): Generator<RegExp, boolean, {
    index: number;
}>;
export declare function has(prefix: ParseYieldable): () => ParseGenerator<boolean>;
export declare function optional(...potentials: Array<ParseYieldable | any>): () => ParseGenerator<any>;
export declare function lookAhead(regex: RegExp): () => Generator<RegExp, RegExpMatchArray, RegExpMatchArray>;
export declare function invert<Result = void>(needle: {}, iterable: ParseGenerator<Result>): string | null;
export {};
