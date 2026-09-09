// Disposable QA schema only. The local API must be started with a separate schema URL.
const assert=require('node:assert/strict');
let token;
async function call(path,method='GET',body){
  const response=await fetch(`http://127.0.0.1:3335/api${path}`,{method,signal:AbortSignal.timeout(45000),headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json(); return {status:response.status,...data};
}
async function main(){
  token=(await call('/auth/login','POST',{email:'admin@rentalbook.local',password:process.env.QA_PASSWORD})).result.token;
  const stamp=Date.now();
  const person=(await call('/employees','POST',{name:`QA CRUD ${stamp}`,contact:'32999999999'})).result;
  const edited=await call(`/employees/${person.id}`,'PATCH',{name:`QA Edited ${stamp}`,contact:'32999999998'}); assert.equal(edited.status,200,JSON.stringify(edited));
  const product=(await call('/products','POST',{name:`QA Product ${stamp}`,category:'QA',defaultRateCents:50000,identifiers:[`CRUD-${stamp}`]})).result;
  const event={startAt:'2027-01-01T18:00:00Z',endAt:'2027-01-01T20:00:00Z',responsibleName:'QA Client',responsibleContact:'32999999999',finalAmountCents:50000,employeeIds:[person.id],employeeFees:[{employeeId:person.id,costCents:10000}],finalNotes:'Initial note',items:[{productId:product.id,quantity:1,productUnitIds:[product.units[0].id]}]};
  const created=await call('/rentals','POST',event); assert.equal(created.status,201,JSON.stringify(created)); assert.equal(created.result.staffCostCents,10000);
  for(const path of [`/employees/${person.id}`,`/products/${product.id}`]) {const blocked=await call(path,'DELETE'); assert.equal(blocked.status,409,JSON.stringify(blocked));}
  const updated=await call(`/rentals/${created.result.id}/operations`,'PATCH',{employeeFees:[{employeeId:person.id,costCents:12500}],finalNotes:'Equipment returned, service completed.'});
  assert.equal(updated.status,200,JSON.stringify(updated)); assert.equal(updated.result.finalAmountCents,50000); assert.equal(updated.result.remainingAmountCents,50000); assert.equal(updated.result.staffCostCents,12500); assert.match(updated.result.finalNotes,/returned/);
  assert.equal((await call(`/rentals/${created.result.id}/operations`,'PATCH',{employeeFees:[{employeeId:999999,costCents:10}]})).status,400);
  const historicalPerson=(await call('/employees','POST',{name:`QA History ${stamp}`})).result;
  const historicalProduct=(await call('/products','POST',{name:`QA History Product ${stamp}`,category:'QA',defaultRateCents:20000,identifiers:[`HISTORY-${stamp}`]})).result;
  const historical=await call('/rentals','POST',{...event,startAt:'2025-01-01T18:00:00Z',endAt:'2025-01-01T20:00:00Z',employeeIds:[historicalPerson.id],employeeFees:[],items:[{productId:historicalProduct.id,quantity:1,productUnitIds:[historicalProduct.units[0].id]}]}); assert.equal(historical.status,201,JSON.stringify(historical));
  for(const path of [`/employees/${historicalPerson.id}`,`/products/${historicalProduct.id}`]) assert.equal((await call(path,'DELETE')).status,200);
  assert.ok(!(await call('/employees')).result.some(e=>e.id===historicalPerson.id));
  assert.ok(!(await call('/products')).result.some(e=>e.id===historicalProduct.id));
  const history=(await call(`/rentals/${historical.result.id}`)).result; assert.equal(history.employees[0].id,historicalPerson.id); assert.equal(history.items[0].productId,historicalProduct.id);
  const report=(await call('/reports/monthly?month=2027-01')).result; assert.ok(report.totals.staffCostCents>=12500);
  const manualPerson=(await call('/employees','POST',{name:`QA Manual ${stamp}`})).result;
  const booking=await call('/staff-bookings','POST',{employeeId:manualPerson.id,title:'Future shift',startAt:event.startAt,endAt:event.endAt}); assert.equal(booking.status,201);
  assert.equal((await call(`/employees/${manualPerson.id}`,'DELETE')).status,409);
  await call(`/staff-bookings/${booking.result.id}`,'DELETE'); assert.equal((await call(`/employees/${manualPerson.id}`,'DELETE')).status,200);
  console.log('PASS: employee edit, safe employee/equipment deletion, future/manual booking guards, historical preservation, event fees and final notes, unchanged customer finances, monthly staff totals.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
