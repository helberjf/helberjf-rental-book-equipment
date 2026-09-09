import {describe,it,expect} from 'vitest';
import {createRentalSchema} from './rental.schemas';
const base={startAt:'2026-10-01T18:00:00Z',endAt:'2026-10-01T20:00:00Z',responsibleName:'Client',responsibleContact:'32999999999',finalAmountCents:50000,employeeIds:[1],items:[]};
describe('event staff costs and final notes',()=>{
  it('preserves costs separately from the client charge',()=>{
    const parsed=createRentalSchema.parse({...base,employeeFees:[{employeeId:1,costCents:12000}],finalNotes:'Everything returned.'});
    expect(parsed).toMatchObject({finalAmountCents:50000,employeeFees:[{employeeId:1,costCents:12000}],finalNotes:'Everything returned.'});
  });
  it.each([
    {fees:[{employeeId:1,costCents:-1}]},
    {fees:[{employeeId:2,costCents:100}]},
    {fees:[{employeeId:1,costCents:100},{employeeId:1,costCents:200}]},
  ])('rejects invalid or unassigned fees %j',({fees})=>{
    expect(createRentalSchema.safeParse({...base,employeeFees:fees}).success).toBe(false);
  });
  it('rejects oversized final notes',()=>expect(createRentalSchema.safeParse({...base,finalNotes:'x'.repeat(4001)}).success).toBe(false));
});
