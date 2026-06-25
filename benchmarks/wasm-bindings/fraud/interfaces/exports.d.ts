/** @module Interface exports **/
export function init(appName: string, symbols: Symbols, stubWasi: boolean): void;
export interface Function {
  protocol: string,
  name: string,
}
export interface Constructor {
  module: string,
  protocol: string,
}
export interface Static {
  module: string,
  protocol: string,
  name: string,
}
export type FunctionExportKind = FunctionExportKindFreestanding | FunctionExportKindConstructor | FunctionExportKindMethod | FunctionExportKindStatic;
export interface FunctionExportKindFreestanding {
  tag: 'freestanding',
  val: Function,
}
export interface FunctionExportKindConstructor {
  tag: 'constructor',
  val: Constructor,
}
export interface FunctionExportKindMethod {
  tag: 'method',
  val: string,
}
export interface FunctionExportKindStatic {
  tag: 'static',
  val: Static,
}
export type ReturnStyle = ReturnStyleNone | ReturnStyleNormal | ReturnStyleResult;
export interface ReturnStyleNone {
  tag: 'none',
}
export interface ReturnStyleNormal {
  tag: 'normal',
}
export interface ReturnStyleResult {
  tag: 'result',
}
export interface FunctionExport {
  kind: FunctionExportKind,
  returnStyle: ReturnStyle,
}
export interface Resource {
  'package': string,
  name: string,
}
export interface Record {
  'package': string,
  name: string,
  fields: Array<string>,
}
export interface Flags {
  'package': string,
  name: string,
  u32Count: number,
}
export interface Tuple {
  count: number,
}
export interface Case {
  name: string,
  hasPayload: boolean,
}
export interface Variant {
  'package': string,
  name: string,
  cases: Array<Case>,
}
export interface Enum {
  'package': string,
  name: string,
  count: number,
}
/**
 * # Variants
 * 
 * ## `"non-nesting"`
 * 
 * ## `"nesting"`
 */
export type OptionKind = 'non-nesting' | 'nesting';
export interface ResultRecord {
  hasOk: boolean,
  hasErr: boolean,
}
export interface Symbols {
  exports: Array<FunctionExport>,
  resources: Array<Resource>,
  records: Array<Record>,
  flags: Array<Flags>,
  tuples: Array<Tuple>,
  variants: Array<Variant>,
  enums: Array<Enum>,
  options: Array<OptionKind>,
  results: Array<ResultRecord>,
}
