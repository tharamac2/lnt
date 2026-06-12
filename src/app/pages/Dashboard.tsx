import { useState, useEffect } from 'react';
import api from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { FileDown, FileText, RefreshCw, Activity, ShieldCheck, AlertTriangle, Hammer, Calendar } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { toast } from 'sonner';

import { User } from '../App';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const Dashboard = ({ user }: { user?: User }) => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        usable: 0,
        scrap: 0,
        expiringSoon: 0,
        overdue: 0
    });
    const [allTools, setAllTools] = useState<any[]>([]);
    const [siteData, setSiteData] = useState<any[]>([]);
    const [statusData, setStatusData] = useState<any[]>([]);
    const [inspectionTrendData, setInspectionTrendData] = useState<any[]>([]);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [scrapByMake, setScrapByMake] = useState<any[]>([]);
    const [leaderboard, setLeaderboard] = useState<any[]>([]); // We'll keep the name but use it for inspected tools
    const [totalMonthlyInspections, setTotalMonthlyInspections] = useState(0);
    const [toolAgeData, setToolAgeData] = useState<any[]>([]);
    const [siteActivityData, setSiteActivityData] = useState<any[]>([]);
    const [atRiskTools, setAtRiskTools] = useState<any[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [allSites, setAllSites] = useState<string[]>([]);
    const [userFilter, setUserFilter] = useState('all');
    const [siteFilter, setSiteFilter] = useState('all');

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [toolsRes, inspectionsRes, movementsRes, usersRes, sitesRes] = await Promise.all([
                api.get('/tools/'),
                api.get('/inspections/'),
                api.get('/movements/?limit=100'),
                api.get('/users/'),
                api.get('/tools/sites/')
            ]);

            const tools = toolsRes.data;
            const inspections = inspectionsRes.data;
            const movements = movementsRes.data;
            const users = usersRes.data;

            setAllUsers(users);
            setAllSites(sitesRes.data);

            setAllTools(tools);

            // Calculate Stats
            const total = tools.length;
            const usable = tools.filter((t: any) => t.status === 'usable').length;
            const scrap = tools.filter((t: any) => t.status === 'scrap').length;

            const today = new Date();
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(today.getDate() + 30);

            const expiringSoon = tools.filter((t: any) => {
                if (!t.expiry_date) return false;
                const exp = new Date(t.expiry_date);
                return exp > today && exp <= thirtyDaysFromNow;
            }).length;

            const overdue = tools.filter((t: any) => {
                if (t.expiry_date) {
                    return new Date(t.expiry_date) < today;
                }
                return false;
            }).length;

            setStats({
                total,
                usable,
                scrap,
                expiringSoon,
                overdue
            });

            // Prepare Chart Data
            // 1. Status Distribution (Donut - Group by ALL statuses)
            const statusCounts: Record<string, number> = {};
            tools.forEach((t: any) => {
                const s = t.status || 'Unknown';
                // Capitalize first letter
                const formatted = s.charAt(0).toUpperCase() + s.slice(1);
                statusCounts[formatted] = (statusCounts[formatted] || 0) + 1;
            });
            const statusChartData = Object.keys(statusCounts).map(s => ({
                name: s,
                value: statusCounts[s],
                color: s === 'Usable' ? '#10B981' :
                    s === 'Scrap' ? '#EF4444' :
                        s === 'Missing' ? '#F59E0B' :
                            s === 'Stolen' ? '#6366F1' : '#94A3B8'
            }));
            setStatusData(statusChartData);

            // 2. Site Distribution (Pie Chart as requested)
            const siteCounts: Record<string, number> = {};
            tools.forEach((t: any) => {
                const site = t.current_site || 'Store'; // Default to Store if null
                siteCounts[site] = (siteCounts[site] || 0) + 1;
            });
            const siteChartData = Object.keys(siteCounts).map(site => ({
                name: site,
                value: siteCounts[site]
            }));
            setSiteData(siteChartData);

            // 3. Inspection Trends (Bar Chart - Last 6 Months)
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(today.getMonth() - 5);
            sixMonthsAgo.setDate(1); // Start of that month

            const recentInspections = inspections.filter((i: any) => new Date(i.date) >= sixMonthsAgo);

            // Group by Month -> Pass/Fail count
            const trendMap: Record<string, { month: string, pass: number, fail: number, conditional: number }> = {};

            // Initialize last 6 months buckets
            for (let i = 0; i < 6; i++) {
                const d = new Date();
                d.setMonth(today.getMonth() - i);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                trendMap[key] = {
                    month: d.toLocaleDateString('default', { month: 'short', year: '2-digit' }),
                    pass: 0,
                    fail: 0,
                    conditional: 0
                };
            }

            recentInspections.forEach((i: any) => {
                const d = new Date(i.date);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (trendMap[key]) {
                    if (i.result === 'pass') trendMap[key].pass++;
                    else if (i.result === 'fail') trendMap[key].fail++;
                    else trendMap[key].conditional++;
                }
            });

            // Convert to array and sort cronologically
            const trendDataArray = Object.values(trendMap).reverse();
            setInspectionTrendData(trendDataArray);

            // 4. Scrap Rate by Manufacturer
            const makeStats: Record<string, { total: number, scrap: number }> = {};
            tools.forEach((t: any) => {
                const make = t.make || 'Unknown';
                if (!makeStats[make]) makeStats[make] = { total: 0, scrap: 0 };
                makeStats[make].total++;
                if (t.status === 'scrap') makeStats[make].scrap++;
            });
            const scrapData = Object.keys(makeStats)
                .map(make => ({
                    name: make,
                    rate: parseFloat(((makeStats[make].scrap / makeStats[make].total) * 100).toFixed(1)),
                    total: makeStats[make].total,
                    scrap: makeStats[make].scrap
                }))
                .filter(d => d.total >= 1) // Only show if at least 1 tool exists
                .sort((a, b) => b.rate - a.rate)
                .slice(0, 5); // Top 5
            setScrapByMake(scrapData);

            // 5. Monthly Inspected Tools
            const inspectedToolsStats: Record<string, number> = {};
            const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            let monthInspectionsCount = 0;

            inspections.forEach((i: any) => {
                if (new Date(i.date) >= currentMonthStart) {
                    monthInspectionsCount++;
                    const name = i.tool?.description || 'Unknown Tool';
                    inspectedToolsStats[name] = (inspectedToolsStats[name] || 0) + 1;
                }
            });
            const board = Object.entries(inspectedToolsStats)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
            setLeaderboard(board);
            setTotalMonthlyInspections(monthInspectionsCount);

            // 6. Recent Activity Feed
            const combinedActivity = [
                ...movements.map((m: any) => ({
                    type: 'movement',
                    id: `mov-${m.id}`,
                    date: new Date(m.timestamp),
                    title: 'Tool Moved',
                    desc: `${m.tool?.description} (${m.tool?.qr_code}) to ${m.to_site}`,
                    user: m.user?.username || 'System',
                    icon: <RefreshCw className="w-4 h-4 text-blue-500" />
                })),
                ...inspections.slice(0, 20).map((i: any) => ({
                    type: 'inspection',
                    id: `insp-${i.id}`,
                    date: new Date(i.date),
                    title: `Inspection: ${i.result}`,
                    desc: `${i.tool?.description} - ${i.remarks || 'No remarks'}`,
                    user: i.inspector?.username || 'Inspector',
                    icon: i.result === 'pass' ? <ShieldCheck className="w-4 h-4 text-green-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />
                }))
            ].sort((a: any, b: any) => b.date.getTime() - a.date.getTime()).slice(0, 20);
            setRecentActivity(combinedActivity);

            // 7. Tool Age Profile
            const ageBuckets = { 'New (<1 yr)': 0, 'Mid-Life (1-3 yrs)': 0, 'Old (>3 yrs)': 0 };
            tools.forEach((t: any) => {
                if (t.date_of_supply) {
                    const supplyDate = new Date(t.date_of_supply);
                    const ageInYears = (today.getTime() - supplyDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
                    if (ageInYears < 1) ageBuckets['New (<1 yr)']++;
                    else if (ageInYears <= 3) ageBuckets['Mid-Life (1-3 yrs)']++;
                    else ageBuckets['Old (>3 yrs)']++;
                }
            });
            const ageData = Object.entries(ageBuckets).map(([name, value]) => ({ name, value }));
            setToolAgeData(ageData);

            // 8. Site Activity Volume (Last 30 Days Movements)
            const siteActivity: Record<string, number> = {};
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 30);

            movements.forEach((m: any) => {
                if (new Date(m.timestamp) >= thirtyDaysAgo) {
                    // Count both From and To sites as activity
                    if (m.from_site) siteActivity[m.from_site] = (siteActivity[m.from_site] || 0) + 1;
                    if (m.to_site) siteActivity[m.to_site] = (siteActivity[m.to_site] || 0) + 1;
                }
            });
            const activityData = Object.entries(siteActivity)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5); // Top 5 busy sites
            setSiteActivityData(activityData);

            // 9. At Risk Expiry List
            const riskList = tools
                .filter((t: any) => t.expiry_date && new Date(t.expiry_date) > today) // Future expiry only
                .sort((a: any, b: any) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())
                .slice(0, 5);
            setAtRiskTools(riskList);

        } catch (error) {
            console.error("Dashboard fetch failed", error);
            toast.error("Failed to load dashboard data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    // Effect to re-process stats when filters change
    useEffect(() => {
        if (allTools.length === 0) return;
        
        let filtered = allTools;
        if (userFilter !== 'all') {
            filtered = filtered.filter(t => t.created_by_id === parseInt(userFilter));
        }
        if (siteFilter !== 'all') {
            filtered = filtered.filter(t => t.current_site === siteFilter);
        }

        // Re-calculate Stats for the subset
        const total = filtered.length;
        const usable = filtered.filter((t: any) => t.status === 'usable').length;
        const scrap = filtered.filter((t: any) => t.status === 'scrap').length;
        
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        
        const expiringSoon = filtered.filter((t: any) => {
            if (!t.expiry_date) return false;
            const exp = new Date(t.expiry_date);
            return exp > today && exp <= thirtyDaysFromNow;
        }).length;
        
        const overdue = filtered.filter((t: any) => {
            if (t.expiry_date) return new Date(t.expiry_date) < today;
            return false;
        }).length;

        setStats({ total, usable, scrap, expiringSoon, overdue });
        
        // Update Chart Data (status distribution only for simplicity)
        const statusCounts: Record<string, number> = {};
        filtered.forEach((t: any) => {
            const s = t.status || 'Unknown';
            const formatted = s.charAt(0).toUpperCase() + s.slice(1);
            statusCounts[formatted] = (statusCounts[formatted] || 0) + 1;
        });
        const statusChartData = Object.keys(statusCounts).map(s => ({
            name: s,
            value: statusCounts[s],
            color: s === 'Usable' ? '#10B981' : s === 'Scrap' ? '#EF4444' : '#94A3B8'
        }));
        setStatusData(statusChartData);

        // Update site distribution
        const siteCounts: Record<string, number> = {};
        filtered.forEach((t: any) => {
            const site = t.current_site || 'Store';
            siteCounts[site] = (siteCounts[site] || 0) + 1;
        });
        setSiteData(Object.entries(siteCounts).map(([name, value]) => ({ name, value })));

    }, [userFilter, siteFilter, allTools]);

    const handleExportExcel = async () => {
        try {
            const inventoryData = allTools.map((tool, index) => ({
                "S.No": index + 1,
                "Tool ID": tool.id,
                "Tool Name": tool.description,
                "QR Code": tool.qr_code,
                "Make": tool.make,
                "Capacity": tool.capacity,
                "SWL": tool.safe_working_load,
                "Purchaser Name": tool.purchaser_name,
                "Purchaser Contact": tool.purchaser_contact,
                "Supplier Code": tool.supplier_code,
                "Date of Supply": tool.date_of_supply ? new Date(tool.date_of_supply).toLocaleDateString() : '',
                "Last Inspection": tool.last_inspection_date ? new Date(tool.last_inspection_date).toLocaleDateString() : '',
                "Inspection Result": tool.inspection_result,
                "Usability %": tool.usability_percentage,
                "Validity (Yrs)": tool.validity_period,
                "Expiry Date": tool.expiry_date ? new Date(tool.expiry_date).toLocaleDateString() : '',
                "Subcontractor": tool.subcontractor_name,
                "Previous Site": tool.previous_site,
                "Current Site": tool.current_site,
                "Next Site": tool.next_site,
                "Job Code": tool.job_code,
                "Job Description": tool.job_description,
                "Status": tool.status,
                "Remarks": tool.inspection_remarks || ''
            }));

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Inventory");

            // Add Headers
            const headers = Object.keys(inventoryData[0] || {});
            const headerRow = worksheet.addRow(headers);

            // Format Header Row (1st Row)
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD9EAD3' } // Light Green background to look visually good
                };
                cell.font = {
                    bold: true,
                    color: { argb: 'FF000000' }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            // Add Data Rows
            inventoryData.forEach(row => {
                worksheet.addRow(Object.values(row));
            });

            // Auto-width columns
            worksheet.columns.forEach(column => {
                column.width = 20;
                column.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Tool_Inventory_Dashboard_${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.success("Inventory exported successfully!");
        } catch (e) {
            console.error(e);
            toast.error("Export failed");
        }
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;

        doc.setFontSize(18);
        doc.text("Tool Inventory Dashboard Report", 14, 20);
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

        // 1. Executive Summary (Stats)
        doc.setFontSize(14);
        doc.text("Executive Summary", 14, 40);

        const statsData = [
            ['Total Tools', stats.total, 'Expiring Soon', stats.expiringSoon],
            ['Usable', stats.usable, 'Overdue', stats.overdue],
            ['Scrap', stats.scrap, '', '']
        ];

        autoTable(doc, {
            startY: 45,
            head: [['Metric', 'Value', 'Metric', 'Value']],
            body: statsData,
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 2 }
        });

        // 2. Status Distribution
        let currentY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.text("Status Distribution", 14, currentY);

        autoTable(doc, {
            startY: currentY + 5,
            head: [['Status', 'Count']],
            body: statusData.map(s => [s.name, s.value]),
            theme: 'grid'
        });

        // 3. Site Stats
        currentY = (doc as any).lastAutoTable.finalY + 10;
        if (currentY > 250) { doc.addPage(); currentY = 20; }
        doc.text("Site Distribution", 14, currentY);

        autoTable(doc, {
            startY: currentY + 5,
            head: [['Site', 'Tool Count']],
            body: siteData.map(s => [s.name, s.value]),
            theme: 'grid'
        });

        // 4. Analysis: Scrap & Age (Side by Side logic usually hard, doing sequential)
        currentY = (doc as any).lastAutoTable.finalY + 10;
        if (currentY > 250) { doc.addPage(); currentY = 20; }
        doc.text("Highest Scrap Rate by Brand", 14, currentY);

        autoTable(doc, {
            startY: currentY + 5,
            head: [['Brand', 'Total Tools', 'Scrapped', 'Rate (%)']],
            body: scrapByMake.map(s => [s.name, s.total, s.scrap, `${s.rate}%`]),
            theme: 'grid'
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
        if (currentY > 250) { doc.addPage(); currentY = 20; }
        doc.text("Tool Age Profile", 14, currentY);

        autoTable(doc, {
            startY: currentY + 5,
            head: [['Age Category', 'Count']],
            body: toolAgeData.map(a => [a.name, a.value]),
            theme: 'grid'
        });

        // 5. Leaderboard & Activity
        currentY = (doc as any).lastAutoTable.finalY + 10;
        // Check if there's enough space for Leaderboard
        if (currentY > 230) {
            doc.addPage();
            currentY = 20;
        }
        doc.text("Top Inspected Tools (This Month)", 14, currentY);

        autoTable(doc, {
            startY: currentY + 5,
            head: [['Rank', 'Tool Name', 'Inspections']],
            body: leaderboard.map((l, i) => [i + 1, l.name, l.count]),
            theme: 'grid'
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
        // Check if there's enough space for Upcoming Risks
        if (currentY > 230) {
            doc.addPage();
            currentY = 20;
        }
        doc.text("Upcoming Expiries (Risks)", 14, currentY);

        autoTable(doc, {
            startY: currentY + 5,
            head: [['Tool', 'Location', 'Expiry Date', 'Days Left']],
            body: atRiskTools.map(t => [
                t.description,
                t.current_site,
                new Date(t.expiry_date).toLocaleDateString(),
                Math.ceil((new Date(t.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            ]),
            theme: 'grid',
            headStyles: { fillColor: [220, 53, 69] } // Red header for risk
        });

        // 6. Recent Activity
        currentY = (doc as any).lastAutoTable.finalY + 10;
        // Check if there's enough space for Activity Log
        if (currentY > 250) {
            doc.addPage();
            currentY = 20;
        }
        doc.text("Recent Activity Log (Last 20)", 14, currentY);

        autoTable(doc, {
            startY: currentY + 5,
            head: [['Time', 'Type', 'Description', 'User']],
            body: recentActivity.map(a => [
                a.date.toLocaleString(),
                a.type.toUpperCase(),
                a.desc,
                a.user
            ]),
            theme: 'grid',
            styles: { fontSize: 8 }
        });

        doc.save(`Dashboard_Full_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success("Comprehensive PDF generated!");
    };

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#0F172A]">Dashboard</h1>
                    <p className="text-gray-500">Overview of tool inventory and status</p>
                </div>
                <div className="flex gap-2">
                    {user?.role === 'admin' && (
                        <>
                            <div className="w-[180px]">
                                <Select value={userFilter} onValueChange={setUserFilter}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Filter Creator" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Creators</SelectItem>
                                        {allUsers.map(u => (
                                            <SelectItem key={u.id} value={u.id.toString()}>{u.full_name || u.username}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-[180px]">
                                <Select value={siteFilter} onValueChange={setSiteFilter}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Filter Store" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Stores</SelectItem>
                                        {allSites.map(site => (
                                            <SelectItem key={site} value={site}>{site}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}
                    <Button variant="outline" onClick={handleExportPDF}>
                        <FileText className="w-4 h-4 mr-2 text-red-600" /> PDF
                    </Button>
                    <Button variant="outline" onClick={handleExportExcel}>
                        <FileDown className="w-4 h-4 mr-2 text-green-600" /> Excel
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="shadow-sm border-l-4 border-l-blue-500">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Tools</p>
                            <h3 className="text-2xl font-bold text-gray-900">{stats.total}</h3>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-full">
                            <Hammer className="w-6 h-6 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-l-4 border-l-green-500">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Usable Tools</p>
                            <h3 className="text-2xl font-bold text-gray-900">{stats.usable}</h3>
                        </div>
                        <div className="p-3 bg-green-50 rounded-full">
                            <ShieldCheck className="w-6 h-6 text-green-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-l-4 border-l-red-500">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Scrap / Unusable</p>
                            <h3 className="text-2xl font-bold text-gray-900">{stats.scrap}</h3>
                        </div>
                        <div className="p-3 bg-red-50 rounded-full">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-l-4 border-l-amber-500">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Expiring (30 Days)</p>
                            <h3 className="text-2xl font-bold text-gray-900">{stats.expiringSoon}</h3>
                        </div>
                        <div className="p-3 bg-amber-50 rounded-full">
                            <Calendar className="w-6 h-6 text-amber-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Status Overview */}
                <Card className="lg:col-span-1">
                    <CardHeader><CardTitle className="text-lg">Status Overview</CardTitle></CardHeader>
                    <CardContent className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                                    {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 2. Site Distribution */}
                <Card className="lg:col-span-1">
                    <CardHeader><CardTitle className="text-lg">Tools by Site</CardTitle></CardHeader>
                    <CardContent className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                                <Pie data={siteData} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                    {siteData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 3. Monthly Inspections (Modified) */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-lg">Total Inspections (Month): {totalMonthlyInspections}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {leaderboard.length > 0 ? leaderboard.map((l, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${i === 0 ? 'bg-yellow-500' : 'bg-gray-400'}`}>
                                            {i + 1}
                                        </div>
                                        <span className="font-medium">{l.name}</span>
                                    </div>
                                    <div className="font-bold text-[#1E3A8A]">{l.count}</div>
                                </div>
                            )) : <p className="text-gray-500 text-sm">No inspections this month.</p>}
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Inspection Trends */}
                <Card className="lg:col-span-2">
                    <CardHeader><CardTitle className="text-lg">Inspection Trends</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={inspectionTrendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="pass" stackId="a" fill="#10B981" />
                                <Bar dataKey="conditional" stackId="a" fill="#F59E0B" />
                                <Bar dataKey="fail" stackId="a" fill="#EF4444" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 5. Scrap Rate by Make (New) */}
                <Card className="lg:col-span-1">
                    <CardHeader><CardTitle className="text-lg">Highest Scrap Rate by Brand</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {scrapByMake.map((item, i) => (
                                <div key={i} className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium">{item.name}</span>
                                        <span className="text-red-600 font-bold">{item.rate}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div className="bg-red-500 h-2 rounded-full" style={{ width: `${item.rate}%` }}></div>
                                    </div>
                                    <p className="text-xs text-gray-500">{item.scrap} scrapped / {item.total} total</p>
                                </div>
                            ))}
                            {scrapByMake.length === 0 && <p className="text-gray-500 text-sm">No scrap data available.</p>}
                        </div>
                    </CardContent>
                </Card>

                {/* 7. Tool Age Profile (New) */}
                <Card className="lg:col-span-1">
                    <CardHeader><CardTitle className="text-lg">Tool Age Profile</CardTitle></CardHeader>
                    <CardContent className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={toolAgeData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#8884d8" barSize={20} radius={[0, 4, 4, 0]}>
                                    {toolAgeData.map((e, index) => (
                                        <Cell key={index} fill={index === 0 ? '#10B981' : index === 1 ? '#F59E0B' : '#EF4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 8. Site Activity Volume (New) */}
                <Card className="lg:col-span-1">
                    <CardHeader><CardTitle className="text-lg">Busiest Sites (30 Days)</CardTitle></CardHeader>
                    <CardContent className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={siteActivityData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="count" fill="#3B82F6" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 9. At Risk Expiry List (New) */}
                <Card className="lg:col-span-1">
                    <CardHeader><CardTitle className="text-lg">Next Expiring Tools</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {atRiskTools.map((tool, i) => (
                                <div key={i} className="flex items-center justify-between p-2 bg-red-50 border border-red-100 rounded text-sm">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-gray-900">{tool.description}</span>
                                        <span className="text-xs text-gray-500">{tool.qr_code}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-red-600">
                                            {tool.expiry_date ? new Date(tool.expiry_date).toLocaleDateString() : '-'}
                                        </div>
                                        <span className="text-xs text-red-500">
                                            {tool.expiry_date ? Math.ceil((new Date(tool.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0} days left
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {atRiskTools.length === 0 && <p className="text-gray-500 text-sm">No upcoming expiries.</p>}
                        </div>
                    </CardContent>
                </Card>

                {/* 6. Recent Activity Feed (New) */}
                <Card className="lg:col-span-3">
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Activity className="w-5 h-5" /> Recent Activity</CardTitle></CardHeader>
                    <CardContent>
                        <div className="max-h-[300px] overflow-y-auto pr-2 space-y-4">
                            {recentActivity.map((activity) => (
                                <div key={activity.id} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="mt-1 p-2 bg-white rounded-full border shadow-sm">
                                        {activity.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between">
                                            <h4 className="font-medium text-gray-900">{activity.title}</h4>
                                            <span className="text-xs text-gray-500">{activity.date.toLocaleString()}</span>
                                        </div>
                                        <p className="text-sm text-gray-600 mt-1">{activity.desc}</p>
                                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                                            <span className="font-medium bg-gray-200 px-2 py-0.5 rounded text-gray-700">{activity.user}</span>
                                            {activity.type === 'movement' && <span>via Mobile</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {recentActivity.length === 0 && <p className="text-center py-8 text-gray-500">No recent activity found.</p>}
                        </div>
                    </CardContent>
                </Card>
            </div>

        </div>
    );
};

export default Dashboard;
