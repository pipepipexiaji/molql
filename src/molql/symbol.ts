/*
 * Copyright (c) 2017 MolQL contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import Type from './type'
import _Symbol from '../mini-lisp/symbol'
import Expression from '../mini-lisp/expression'

export type Argument<T extends Type = Type>  = {
    type: T,
    isOptional: boolean,
    isRest: boolean,
    defaultValue: T['@type'] | undefined,
    description: string | undefined
}
export function Argument<T extends Type>(type: T, params?: { description?: string, defaultValue?: T['@type'], isOptional?: boolean, isRest?: boolean }): Argument<T> {
    const { description = void 0, isOptional = false, isRest = false, defaultValue = void 0 } = params || {}
    return { type, isOptional, isRest, defaultValue, description };
}

export type Arguments<T extends { [key: string]: any } = {}> =
    | Arguments.List<T>
    | Arguments.Dictionary<T>

export namespace Arguments {
    export const None: Arguments = Dictionary({});

    export interface Dictionary<T extends { [key: string]: any } = {}, Traits = {}> {
        kind: 'dictionary',
        map: { [P in keyof T]: Argument<T[P]> },
        '@type': T
    }
    export function Dictionary<Map extends { [key: string]: Argument<any> }>(map: Map): Arguments<{ [P in keyof Map]: Map[P]['type']['@type'] }> {
        return { kind: 'dictionary', map, '@type': 0 as any };
    }

    export interface List<T extends { [key: string]: any } = {}, Traits = {}> {
        kind: 'list',
        type: Type,
        nonEmpty: boolean,
        '@type': T
    }

    export function List<T extends Type>(type: T, params?: { nonEmpty?: boolean }): Arguments<{ [key: string]: T['@type'] }> {
        const { nonEmpty = false } = params || { }
        return { kind: 'list', type, nonEmpty, '@type': 0 as any };
    }
}

export type ExpressionArguments<T> = { [P in keyof T]?: Expression } | { [index: number]: Expression }

interface Symbol<A extends Arguments = Arguments, T extends Type = Type> extends _Symbol {
    (args?: ExpressionArguments<A['@type']>): Expression,
    info: {
        namespace: string,
        name: string,
        description?: string
    },
    args: A
    type: T,
    id: string,
}

function Symbol<A extends Arguments, T extends Type>(name: string, args: A, type: T, description?: string) {
    const symbol: Symbol<A, T> = function(args: ExpressionArguments<A['@type']>) {
        return Expression.Apply(symbol.id, args as any);
    } as any;
    symbol.info = { namespace: '', name, description };
    symbol.id = '';
    symbol.args = args;
    symbol.type = type;
    return symbol;
}

export function isSymbol(x: any): x is Symbol {
    const s = x as Symbol;
    return typeof s === 'function' && !!s.info && !!s.args && typeof s.info.namespace === 'string' && !!s.type;
}

export type SymbolMap = { [id: string]: Symbol | undefined }

export default Symbol

