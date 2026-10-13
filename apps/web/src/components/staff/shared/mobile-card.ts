/**
 * Below `md` a staff table becomes a list of cards (rows are grids, headers hide) so that nothing needs a horizontal swipe.
 * Apply `MOBILE_TABLE`/`MOBILE_TABLE_BODY` to the table and its body, `MOBILE_TABLE_HEAD` to its header and `MOBILE_ROW` to
 * each row; a cell with `data-label` shows that label above its value on mobile (`MOBILE_LABELLED_CELL`).
 */
export const MOBILE_TABLE = 'max-md:block';
export const MOBILE_TABLE_BODY = 'max-md:block';
export const MOBILE_TABLE_HEAD = 'max-md:hidden';
export const MOBILE_ROW = 'max-md:grid max-md:grid-cols-2 max-md:items-center max-md:gap-x-4 max-md:gap-y-2 max-md:px-4 max-md:py-3';
export const MOBILE_CELL = 'max-md:p-0 max-md:whitespace-normal';
export const MOBILE_LABELLED_CELL = `${MOBILE_CELL} max-md:text-sm max-md:before:block max-md:before:text-[10px] max-md:before:uppercase max-md:before:tracking-[0.2em] max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)]`;
