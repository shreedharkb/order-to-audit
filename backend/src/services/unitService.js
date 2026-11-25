const unitDimensions = {
  kg: 'mass',
  g: 'mass',
  litre: 'volume',
  ml: 'volume',
  piece: 'count',
  packet: 'count',
  carton: 'count'
};

const unitFactors = {
  kg: 1,
  g: 0.001,
  litre: 1,
  ml: 0.001
};

const normalizeQuantity = (qty, fromUnit, toUnit) => {
  const quantity = Number(qty);
  const from = String(fromUnit || '').toLowerCase();
  const to = String(toUnit || '').toLowerCase();

  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error('Quantity must be a non-negative number');
  }
  if (!unitDimensions[from] || !unitDimensions[to]) {
    throw new Error(`Unsupported unit: ${fromUnit || 'missing'} or ${toUnit || 'missing'}`);
  }
  if (unitDimensions[from] !== unitDimensions[to]) {
    throw new Error(`Cannot convert ${fromUnit} to ${toUnit}`);
  }
  if (unitDimensions[from] === 'count' && from !== to) {
    throw new Error(`Count units must match: ${fromUnit} and ${toUnit}`);
  }

  const converted = unitDimensions[from] === 'count'
    ? quantity
    : quantity * unitFactors[from] / unitFactors[to];

  return Number(converted.toFixed(4));
};

module.exports = { normalizeQuantity };
