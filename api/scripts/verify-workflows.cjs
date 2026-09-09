// Run only against the isolated QA schema served by the local API.
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:3335';
let token;
async function request(path, method='GET', data) {
  console.log(method, path);
  const response = await fetch(base + '/api' + path, { signal: AbortSignal.timeout(30000), method, headers: { 'content-type':'application/json', ...(token ? {authorization:`Bearer ${token}`} : {}) }, ...(data ? {body:JSON.stringify(data)} : {}) });
  return {status:response.status,...await response.json()};
}
async function main() {
  const stamp=Date.now();
  const unauthorized = await request('/employees'); assert.equal(unauthorized.status,401);
  const login=await request('/auth/login','POST',{email:'admin@rentalbook.local',password:process.env.QA_PASSWORD});
  assert.equal(login.status,200); token=login.result.token;
  const person=await request('/employees','POST',{name:`QA Employee ${stamp}`,contact:'32999990000'}); assert.equal(person.status,201);
  const person2=await request('/employees','POST',{name:`QA Operator ${stamp}`,contact:'32999990001'}); assert.equal(person2.status,201);
  const person3=await request('/employees','POST',{name:`QA Assistant ${stamp}`,contact:'32999990003'}); assert.equal(person3.status,201);
  const product=await request('/products','POST',{name:`QA Robot ${stamp}`,category:'QA',weightKg:12,heightCm:290,widthCm:100,lengthCm:70,color:'Blue',defaultRateCents:25000,identifiers:[`QA-${stamp}-1`,`QA-${stamp}-2`]});
  assert.equal(product.status,201); assert.equal(product.result.units.length,2);
  const patch=await request(`/products/${product.result.id}`,'PATCH',{name:product.result.name,category:'QA',weightKg:15,heightCm:280,widthCm:90,lengthCm:65,color:'Multicolor',defaultRateCents:35000}); assert.equal(patch.status,200);
  const range={startAt:'2026-12-10T18:00:00Z',endAt:'2026-12-10T20:00:00Z'};
  const booking={employeeId:person.result.id,title:'QA private booking',...range};
  const manual=await request('/staff-bookings','POST',booking); assert.equal(manual.status,201,JSON.stringify(manual));
  const conflict=await request('/staff-bookings','POST',booking); assert.equal(conflict.status,409);
  const adjacent=await request('/staff-bookings','POST',{...booking,startAt:range.endAt,endAt:'2026-12-10T21:00:00Z'}); assert.equal(adjacent.status,201);
  const availability=await request(`/employees?startAt=${range.startAt}&endAt=${range.endAt}`); assert.equal(availability.result.find(e=>e.id===person.result.id).available,false);
  const payload={...range,responsibleName:'QA Customer',responsibleContact:'32999990002',employeeIds:[person.result.id],items:[{productId:product.result.id,quantity:1,productUnitIds:[product.result.units[0].id],unitPriceCents:35000}],finalAmountCents:35000,confirm:true};
  const before=(await request('/rentals')).result.length;
  const blocked=await request('/rentals','POST',payload); assert.equal(blocked.status,409);
  assert.equal((await request('/rentals')).result.length,before,'failed confirmation must not leave a draft or payment');
  const rental=await request('/rentals','POST',{...payload,employeeIds:[person2.result.id],initialPayment:{amountCents:10000,method:'PIX'}}); assert.equal(rental.status,201); assert.equal(rental.result.remainingAmountCents,25000);
  const staffConflict=await request('/staff-bookings','POST',{...booking,employeeId:person2.result.id}); assert.equal(staffConflict.status,409);
  const equipmentConflict=await request('/rentals','POST',{...payload,employeeIds:[person3.result.id]}); assert.equal(equipmentConflict.status,409); assert.match(equipmentConflict.message,/equipment is already reserved/);
  const paid=await request(`/rentals/${rental.result.id}/payments`,'POST',{amountCents:25000,method:'PIX'}); assert.equal(paid.result.remainingAmountCents,0);
  const service=await request('/rentals','POST',{...payload,startAt:'2026-12-11T18:00:00Z',endAt:'2026-12-11T20:00:00Z',items:[]}); assert.equal(service.status,201);
  const race=await Promise.all([request('/staff-bookings','POST',{...booking,startAt:'2026-12-12T18:00:00Z',endAt:'2026-12-12T20:00:00Z'}),request('/staff-bookings','POST',{...booking,startAt:'2026-12-12T18:00:00Z',endAt:'2026-12-12T20:00:00Z'})]);
  assert.deepEqual(race.map(r=>r.status).sort(),[201,409]);
  const report=await request('/reports/monthly?month=2026-12'); assert.equal(report.status,200); assert.ok(report.result.totals.events>=2);
  const calendar=await request('/calendar/events'); assert.ok(calendar.result.some(e=>e.id===rental.result.id));
  const catalog=await request('/products'); assert.equal(catalog.result.find(p=>p.id===product.result.id).weightKg,15);
  const removed=await request(`/staff-bookings/${manual.result.id}`,'DELETE'); assert.equal(removed.status,200);
  console.log('PASS: authentication, equipment create/edit, staff create, reservations, adjacent times, concurrent conflict, atomic event rejection, service-only event, payments, calendar, monthly report, reservation release.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
