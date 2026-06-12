export interface Tool {
  id: string;
  description: string;
  make: string;
  capacity: string;
  safeWorkingLoad: string;
  purchaserName: string;
  purchaserContact: string;
  dateOfSupply: string;
  lastInspectionDate: string;
  inspectionResult: 'usable' | 'not-usable';
  usabilityPercentage?: number;
  validityPeriod?: number;
  subcontractorName: string;
  previousSite: string;
  currentSite: string;
  nextSite: string;
  qrCode: string;
  status: 'usable' | 'scrap';
  expiryDate: string;
}

export interface Inspection {
  id: string;
  toolId: string;
  date: string;
  result: 'pass' | 'conditional' | 'fail';
  usabilityPercentage?: number;
  remarks: string;
  photos: string[];
  inspector: string;
}

export const mockTools: Tool[] = [
  {
    id: 'T001',
    description: 'Chain Hoist 5T',
    make: 'Yale',
    capacity: '5 Tonnes',
    safeWorkingLoad: '5000 kg',
    purchaserName: 'ABC Construction',
    purchaserContact: '+1234567890',
    dateOfSupply: '2023-01-15',
    lastInspectionDate: '2024-11-20',
    inspectionResult: 'usable',
    usabilityPercentage: 95,
    validityPeriod: 1,
    subcontractorName: 'XYZ Contractors',
    previousSite: 'Site A',
    currentSite: 'Site B',
    nextSite: 'Site C',
    qrCode: 'TOOL-T001-2023',
    status: 'usable',
    expiryDate: '2025-11-20',
  },
  {
    id: 'T002',
    description: 'Wire Rope Sling 10T',
    make: 'Crosby',
    capacity: '10 Tonnes',
    safeWorkingLoad: '10000 kg',
    purchaserName: 'DEF Industries',
    purchaserContact: '+0987654321',
    dateOfSupply: '2023-03-10',
    lastInspectionDate: '2024-10-15',
    inspectionResult: 'usable',
    usabilityPercentage: 75,
    validityPeriod: 1,
    subcontractorName: 'PQR Services',
    previousSite: 'Site D',
    currentSite: 'Site E',
    nextSite: 'Site F',
    qrCode: 'TOOL-T002-2023',
    status: 'usable',
    expiryDate: '2025-01-15',
  },
  {
    id: 'T003',
    description: 'Hydraulic Jack 20T',
    make: 'Enerpac',
    capacity: '20 Tonnes',
    safeWorkingLoad: '20000 kg',
    purchaserName: 'GHI Engineering',
    purchaserContact: '+1122334455',
    dateOfSupply: '2022-08-20',
    lastInspectionDate: '2024-12-01',
    inspectionResult: 'not-usable',
    subcontractorName: 'LMN Corp',
    previousSite: 'Site G',
    currentSite: 'Site H',
    nextSite: '',
    qrCode: 'TOOL-T003-2022',
    status: 'scrap',
    expiryDate: '2024-12-01',
  },
];

export const mockInspections: Inspection[] = [
  {
    id: 'I001',
    toolId: 'T001',
    date: '2024-11-20',
    result: 'pass',
    usabilityPercentage: 95,
    remarks: 'Tool in excellent condition',
    photos: [],
    inspector: 'John Doe',
  },
  {
    id: 'I002',
    toolId: 'T002',
    date: '2024-10-15',
    result: 'conditional',
    usabilityPercentage: 75,
    remarks: 'Minor wear on wire strands, monitor closely',
    photos: [],
    inspector: 'Jane Smith',
  },
];
