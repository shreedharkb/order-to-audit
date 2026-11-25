import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import LoadingSpinner from '../../components/LoadingSpinner';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';
import { Users, Plus } from 'lucide-react';

export default function CustomerManagement() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState('retailer');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Tamil Nadu');
  const [stateCode, setStateCode] = useState('33');
  const [phone, setPhone] = useState('');

  const fetchCustomers = () => {
    setLoading(true);
    client.get('/masters/customers')
      .then(res => setCustomers(res.data))
      .catch(err => toast.error('Failed to load customers'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleStateChange = (st) => {
    setState(st);
    if (st === 'Tamil Nadu') setStateCode('33');
    else if (st === 'Karnataka') setStateCode('29');
    else if (st === 'Kerala') setStateCode('32');
    else if (st === 'Andhra Pradesh') setStateCode('37');
    else setStateCode('99');
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      await client.post('/masters/customers', {
        name,
        type,
        gstin,
        address,
        city,
        state,
        state_code: stateCode,
        phone
      });
      toast.success('Customer registered successfully');
      setShowModal(false);
      setName('');
      setGstin('');
      setAddress('');
      setPhone('');
      fetchCustomers();
    } catch (err) {
      toast.error('Failed to create customer');
    }
  };

  const columns = [
    { key: 'name', label: 'Business Name' },
    { key: 'type', label: 'Type', render: val => <span className="uppercase text-xs font-bold px-2 py-0.5 rounded bg-gray-100">{val}</span> },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State', render: (val, r) => `${val} (${r.state_code})` },
    { key: 'gstin', label: 'GSTIN', render: val => <span className="font-mono text-xs">{val || 'Unregistered'}</span> },
    { key: 'phone', label: 'Phone', render: val => val || '-' }
  ];

  if (loading) return <LoadingSpinner message="Loading customer directory..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Customer Directory</h1>
          <p className="text-sm text-gray-500">Retailers and distributors with place of supply and GST compliance</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-orange-600 text-white font-bold text-sm hover:bg-orange-700 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={customers}
        searchPlaceholder="Search customer, city, state, or GSTIN..."
      />

      {showModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Add New Customer</h3>
            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Business Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full p-2.5 text-sm border rounded-xl"
                  placeholder="e.g. Sri Krishna Sweets"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Customer Type</label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value)}
                    className="w-full p-2.5 text-sm border rounded-xl"
                  >
                    <option value="retailer">Retailer</option>
                    <option value="distributor">Distributor</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">State</label>
                  <select
                    value={state}
                    onChange={e => handleStateChange(e.target.value)}
                    className="w-full p-2.5 text-sm border rounded-xl"
                  >
                    <option value="Tamil Nadu">Tamil Nadu (33)</option>
                    <option value="Karnataka">Karnataka (29)</option>
                    <option value="Kerala">Kerala (32)</option>
                    <option value="Andhra Pradesh">Andhra Pradesh (37)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">GSTIN</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={e => setGstin(e.target.value)}
                  className="w-full p-2.5 text-sm font-mono border rounded-xl uppercase"
                  placeholder="e.g. 33AABCS1234A1Z1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full p-2.5 text-sm border rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold text-white bg-orange-600 rounded-xl"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
