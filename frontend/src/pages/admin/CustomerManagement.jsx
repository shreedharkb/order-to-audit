import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import LoadingSpinner from '../../components/LoadingSpinner';
import DataTable from '../../components/DataTable';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';

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
          <h1 className="page-title">Customer Directory</h1>
          <p className="page-subtitle">Retailers and distributors with place of supply and GST compliance</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4" /> Add customer
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={customers}
        searchPlaceholder="Search customer, city, state, or GSTIN..."
      />

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>Register a retailer or distributor with place of supply and GST compliance.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCustomer} className="space-y-3">
            <div>
              <label className="label">Business Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="input-field"
                placeholder="e.g. Sri Krishna Sweets"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Customer Type</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  className="input-field"
                >
                  <option value="retailer">Retailer</option>
                  <option value="distributor">Distributor</option>
                </select>
              </div>
              <div>
                <label className="label">State</label>
                <select
                  value={state}
                  onChange={e => handleStateChange(e.target.value)}
                  className="input-field"
                >
                  <option value="Tamil Nadu">Tamil Nadu (33)</option>
                  <option value="Karnataka">Karnataka (29)</option>
                  <option value="Kerala">Kerala (32)</option>
                  <option value="Andhra Pradesh">Andhra Pradesh (37)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">GSTIN</label>
              <input
                type="text"
                value={gstin}
                onChange={e => setGstin(e.target.value)}
                className="input-field font-mono uppercase"
                placeholder="e.g. 33AABCS1234A1Z1"
              />
            </div>

            <div>
              <label className="label">City</label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="input-field"
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancel</Button>
              </DialogClose>
              <Button type="submit">Save Customer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
