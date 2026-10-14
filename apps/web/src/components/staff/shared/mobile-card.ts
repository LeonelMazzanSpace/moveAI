/**
 * Below `xl` a staff table becomes a list of cards (rows are grids, headers stay for assistive technology but leave the layout) so that nothing needs a horizontal swipe.
 * Apply `MOBILE_TABLE`/`MOBILE_TABLE_BODY` to the table and its body, `MOBILE_TABLE_HEAD` to its header and `MOBILE_ROW` to
 * each row; a cell with `data-label` shows that label above its value on mobile (`MOBILE_LABELLED_CELL`).
 */
export const MOBILE_TABLE = 'max-xl:block';
export const MOBILE_TABLE_BODY = 'max-xl:block';
export const MOBILE_TABLE_HEAD = 'max-xl:sr-only';
export const MOBILE_ROW = 'max-xl:grid max-xl:grid-cols-2 max-xl:items-center max-xl:gap-x-4 max-xl:gap-y-2 max-xl:px-4 max-xl:py-3';
export const MOBILE_CELL = 'max-xl:p-0 max-xl:whitespace-normal';
export const MOBILE_LABELLED_CELL = `${MOBILE_CELL} max-xl:text-sm max-xl:before:block max-xl:before:text-[10px] max-xl:before:uppercase max-xl:before:tracking-[0.2em] max-xl:before:text-muted-foreground max-xl:before:content-[attr(data-label)]`;
