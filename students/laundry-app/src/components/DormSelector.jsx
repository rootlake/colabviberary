import { useDorm } from '../contexts/DormContext';

function DormSelector() {
  const { currentDorm } = useDorm();

  return (
    <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-lg shadow-md mb-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">{currentDorm.name} Laundry</h2>
        <p className="text-blue-100 text-sm mt-1">Dormitory Laundry Management</p>
      </div>
    </div>
  );
}

export default DormSelector;
