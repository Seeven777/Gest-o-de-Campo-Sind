/** A regex sozinha aceita datas impossíveis, como 2026-02-30. */
export function validISODate(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const timestamp=Date.parse(value);
 return Number.isFinite(timestamp)&&new Date(timestamp).toISOString().slice(0,10)===value;
}
