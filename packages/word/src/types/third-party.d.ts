// 第三方库类型声明：file-saver 未提供内置 d.ts
declare module 'file-saver' {
  export function saveAs(data: Blob | string, filename?: string, disableAutoBOM?: boolean): void;
}
