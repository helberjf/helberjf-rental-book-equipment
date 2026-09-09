import { describe, it, expect, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { assertStaffAvailable } from './staff-availability';
import { bookingSchema, productSchema } from '../schemas/catalog.schemas';
const start = new Date('2026-10-01T18:00:00Z');
const end = new Date('2026-10-01T20:00:00Z');
const mock = () => ({ $executeRaw:vi.fn().mockResolvedValue(1), employee:{count:vi.fn().mockResolvedValue(1)}, employeeBooking:{findFirst:vi.fn().mockResolvedValue(null)}, rentalEmployee:{findFirst:vi.fn().mockResolvedValue(null)} });
describe('Staff availability', () => {
  it('checks manual bookings and confirmed event assignments using half-open intervals', async () => {
    const tx = mock(); await assertStaffAvailable(tx as unknown as Prisma.TransactionClient,[1],start,end,10);
    expect(tx.employeeBooking.findFirst).toHaveBeenCalledWith({where:{employeeId:{in:[1]},startAt:{lt:end},endAt:{gt:start}}});
    expect(tx.rentalEmployee.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({rental:expect.objectContaining({id:{not:10},startAt:{lt:end},endAt:{gt:start}})})}));
    expect(tx.$executeRaw).toHaveBeenCalledOnce();
  });
  it.each(['manual','event'])('rejects conflicts from %s reservations', async source => {
    const tx=mock();
    (source === 'manual' ? tx.employeeBooking : tx.rentalEmployee).findFirst.mockResolvedValue({id:1});
    await expect(assertStaffAvailable(tx as unknown as Prisma.TransactionClient,[1],start,end)).rejects.toThrow('already reserved');
  });
  it('rejects an inactive employee', async () => {
    const tx=mock(); tx.employee.count.mockResolvedValue(0);
    await expect(assertStaffAvailable(tx as unknown as Prisma.TransactionClient,[1],start,end)).rejects.toThrow('unavailable');
  });
  it('rejects inverted and zero-length bookings', () => {
    for (const endAt of [start,new Date(start.getTime()-1)]) expect(bookingSchema.safeParse({employeeId:1,title:'Service',startAt:start,endAt}).success).toBe(false);
  });
  it('rejects negative dimensions and duplicate equipment identifiers', () => {
    const product={name:'Robot',category:'LED',defaultRateCents:25000,identifiers:['R1']};
    expect(productSchema.safeParse({...product,weightKg:-3}).success).toBe(false);
    expect(productSchema.safeParse({...product,identifiers:['R1','R1']}).success).toBe(false);
    expect(productSchema.parse(product).defaultRateCents).toBe(25000);
  });
});
