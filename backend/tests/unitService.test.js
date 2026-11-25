const unitService = require('../src/services/unitService');

describe('Inventory unit conversion', () => {
  test('converts grams to kilograms without drifting', () => {
    expect(unitService.normalizeQuantity(250, 'g', 'kg')).toBe(0.25);
    expect(unitService.normalizeQuantity(1.5, 'kg', 'g')).toBe(1500);
  });

  test('converts millilitres to litres', () => {
    expect(unitService.normalizeQuantity(500, 'ml', 'litre')).toBe(0.5);
  });

  test('accepts matching count units', () => {
    expect(unitService.normalizeQuantity(20, 'piece', 'piece')).toBe(20);
  });

  test('rejects incompatible dimensions and guessed carton conversions', () => {
    expect(() => unitService.normalizeQuantity(1, 'kg', 'litre')).toThrow('Cannot convert');
    expect(() => unitService.normalizeQuantity(1, 'carton', 'packet')).toThrow('Count units must match');
  });

  test('rejects negative and non-finite quantities', () => {
    expect(() => unitService.normalizeQuantity(-1, 'kg', 'kg')).toThrow('non-negative');
    expect(() => unitService.normalizeQuantity(Number.NaN, 'kg', 'kg')).toThrow('non-negative');
  });
});
