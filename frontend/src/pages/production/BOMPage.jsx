import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { BookOpen, Layers } from 'lucide-react';

export default function BOMPage() {
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/masters/bom')
      .then(res => setBoms(res.data))
      .catch(err => toast.error('Failed to load BOMs'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading recipe master..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Recipe Master (Bill of Materials)</h1>
        <p className="text-sm text-gray-500">Standard material and packaging requirements per production batch with expected yields</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {boms.map(bom => (
          <div key={bom.id} className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-orange-600">Standard Production Recipe</span>
                <h2 className="text-xl font-black text-gray-900">{bom.batch_name} ({bom.finished_item_name})</h2>
                <p className="text-xs text-gray-500">{bom.notes}</p>
              </div>
              <div className="px-4 py-2 bg-orange-50 rounded-xl border border-orange-200 text-left sm:text-right">
                <span className="text-xs text-orange-800 font-bold block">Expected Yield per Batch</span>
                <span className="text-lg font-black text-orange-950">{bom.expected_yield} {bom.yield_unit}s</span>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 text-sm mb-3">Ingredient & Packaging Specifications:</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 font-bold text-gray-700">
                    <tr>
                      <th className="p-3">Item Name</th>
                      <th className="p-3">Type</th>
                      <th className="p-3 text-right">Standard Quantity per Batch</th>
                      <th className="p-3">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bom.lines?.map((line, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-3 font-bold text-gray-900">{line.item_name}</td>
                        <td className="p-3 uppercase text-[10px] text-gray-500">{line.item_type.replace('_', ' ')}</td>
                        <td className="p-3 text-right font-bold text-gray-800">{line.qty_per_batch}</td>
                        <td className="p-3 text-gray-600">{line.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
