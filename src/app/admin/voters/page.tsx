'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Users,
  ArrowLeft,
  Upload,
  UserPlus,
  Trash2,
  Printer,
  Search,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  RefreshCw,
  Download,
  FileText,
  X,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Filter,
  Lock,
  Unlock,
  ShieldAlert,
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Voter {
  id: number;
  nim: string;
  name: string;
  password?: string;
  randomPassword?: string;
  hasVoted: boolean;
  isLocked?: boolean;
}

export default function AdminVotersPage() {
  const [appName, setAppName] = useState('TPS-DIGITAL');
  const [subTitle, setSubTitle] = useState('Sistem E-Voting Terenkripsi & Transparan');
  const [logoUrl, setLogoUrl] = useState<string | null>('/images/default-logo.png');

  const [voters, setVoters] = useState<Voter[]>([]);
  const [filteredVoters, setFilteredVoters] = useState<Voter[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'voted' | 'not_voted'>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingVoter, setEditingVoter] = useState<Voter | null>(null);
  const [editNim, setEditNim] = useState('');
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Premium Excel Upload Modal State
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [excelErrorMsg, setExcelErrorMsg] = useState('');
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);

  // Result Summary Modal State
  const [importResultModal, setImportResultModal] = useState<{
    isOpen: boolean;
    total: number;
    successCount: number;
    duplicateCount: number;
    failedCount: number;
    duplicateList: string[];
  } | null>(null);

  // Lock Confirm & Result Premium Modals
  const [lockConfirmModal, setLockConfirmModal] = useState<{
    isOpen: boolean;
    isLocked: boolean;
    target: 'unvoted' | 'all' | 'ids';
    ids?: number[];
    title: string;
    description: string;
    count: number;
  } | null>(null);

  const [lockResultModal, setLockResultModal] = useState<{
    isOpen: boolean;
    isSuccess: boolean;
    title: string;
    message: string;
    count?: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Download Template Excel (.xlsx) Resmi
  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/images/format_template_daftar_pemilih.xlsx';
    link.setAttribute('download', 'format_template_daftar_pemilih.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Drag and Drop File Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDropExcel = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setExcelErrorMsg('');
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls') ||
        file.name.endsWith('.csv')
      ) {
        setExcelFile(file);
      } else {
        setExcelErrorMsg('Format file tidak didukung. Harap unggah file .xlsx, .xls, atau .csv');
      }
    }
  };

  const handleSelectExcelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExcelErrorMsg('');
    const file = e.target.files?.[0];
    if (file) {
      if (
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls') ||
        file.name.endsWith('.csv')
      ) {
        setExcelFile(file);
      } else {
        setExcelErrorMsg('Format file tidak didukung. Harap unggah file .xlsx, .xls, atau .csv');
      }
    }
  };

  // Helper Load SheetJS CDN secara dinamis jika mengunggah file .xlsx / .xls
  const loadXlsxScript = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).XLSX) {
        resolve((window as any).XLSX);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      script.onload = () => resolve((window as any).XLSX);
      script.onerror = () => reject(new Error('Gagal memuat library pemroses Excel (XLSX).'));
      document.body.appendChild(script);
    });
  };

  // Process Excel/CSV Parsing & Upload (Parsing Biner Presisi .xlsx & CSV)
  const handleProcessExcelUpload = async () => {
    if (!excelFile) return;
    setIsUploadingExcel(true);
    setExcelErrorMsg('');

    try {
      let votersToUpload: { nim: string; name: string }[] = [];

      if (excelFile.name.endsWith('.csv')) {
        // Pembacaan Teks untuk File CSV
        const text = await excelFile.text();
        const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

        lines.forEach((line, idx) => {
          if (
            idx === 0 &&
            (line.toLowerCase().includes('id') ||
              line.toLowerCase().includes('nim') ||
              line.toLowerCase().includes('nama'))
          ) {
            return;
          }
          const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
          if (cols.length >= 2 && cols[0] && cols[1]) {
            votersToUpload.push({ nim: cols[0], name: cols[1] });
          }
        });
      } else {
        // Pembacaan Biner (.xlsx / .xls) Menggunakan SheetJS
        const XLSX = await loadXlsxScript();
        const arrayBuffer = await excelFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        jsonRows.forEach((row: any[], idx: number) => {
          if (!row || row.length < 2) return;
          const col0 = String(row[0] || '').trim();
          const col1 = String(row[1] || '').trim();

          // Lewati Baris Header Tabel
          if (
            idx === 0 &&
            (col0.toLowerCase().includes('id') ||
              col0.toLowerCase().includes('nim') ||
              col1.toLowerCase().includes('nama'))
          ) {
            return;
          }

          if (col0 && col1) {
            votersToUpload.push({ nim: col0, name: col1 });
          }
        });
      }

      // Filter Karakter Aneh Non-Printable / Binary Noise
      votersToUpload = votersToUpload.filter(
        (v) => !/[^\x20-\x7E]/.test(v.nim) && !/[^\x20-\x7E]/.test(v.name)
      );

      if (votersToUpload.length === 0) {
        setExcelErrorMsg('File Excel tidak berisi data pemilih yang valid.');
        setIsUploadingExcel(false);
        return;
      }

      // Kirim seluruh data Excel dalam 1x HTTP Request Bulk Batch (SUPER FAST)
      const res = await fetch('/api/voters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: true, voters: votersToUpload }),
      });
      const data = await res.json();

      let successCount = 0;
      let duplicateCount = 0;
      let failedCount = 0;
      let duplicateList: string[] = [];

      if (res.ok && data.success) {
        successCount = data.successCount || 0;
        duplicateCount = data.duplicateCount || 0;
        duplicateList = data.duplicateList || [];
      } else {
        failedCount = votersToUpload.length;
      }

      setIsUploadingExcel(false);
      setIsExcelModalOpen(false);
      setExcelFile(null);
      setSearchTerm('');
      await fetchVotersData();

      // Tampilkan Modal Laporan Hasil Rekapitulasi Import
      setImportResultModal({
        isOpen: true,
        total: votersToUpload.length,
        successCount,
        duplicateCount,
        failedCount,
        duplicateList,
      });
    } catch (err: any) {
      console.error(err);
      setExcelErrorMsg(err.message || 'Gagal membaca atau memproses file Excel.');
      setIsUploadingExcel(false);
    }
  };

  // State Kop Surat dari Settings API
  const [kopUrl, setKopUrl] = useState<string | null>(null);

  // Fetch voters & settings secara PARALEL untuk kecepatan maksimal (Instant UI + Background Sync)
  const fetchVotersData = async () => {
    try {
      const [votersRes, settingsRes] = await Promise.all([
        fetch('/api/voters', { cache: 'no-store' }),
        fetch('/api/settings', { cache: 'no-store' }),
      ]);

      const [votersJson, settingsJson] = await Promise.all([
        votersRes.json(),
        settingsRes.json(),
      ]);

      if (votersJson.success && Array.isArray(votersJson.data) && votersJson.data.length > 0) {
        setVoters(votersJson.data);
        setFilteredVoters(votersJson.data);
        if (typeof window !== 'undefined') {
          localStorage.setItem('voters_cache', JSON.stringify(votersJson.data));
        }
      } else {
        // Fallback: Ambil data pemilih langsung via Firebase Web SDK Client Browser
        try {
          const { collection, getDocs } = await import('firebase/firestore');
          const { db: fdb } = await import('@/lib/firebase');
          const snap = await getDocs(collection(fdb, 'users'));
          const list: any[] = [];
          snap.forEach((d) => {
            const data = d.data();
            if (data.role === 'VOTER' || (!data.role && data.nim !== 'admin')) {
              list.push({
                id: d.id,
                nim: data.nim,
                name: data.name,
                randomPassword: data.randomPassword || '***',
                hasVoted: data.hasVoted || false,
                votedAt: data.votedAt || null,
                createdAt: data.createdAt || null,
              });
            }
          });
          if (list.length > 0) {
            setVoters(list);
            setFilteredVoters(list);
            if (typeof window !== 'undefined') {
              localStorage.setItem('voters_cache', JSON.stringify(list));
            }
          }
        } catch (clientFsErr) {
          console.warn('[Client SDK Fetch Fallback]:', clientFsErr);
        }
      }

      if (settingsJson.success && settingsJson.data) {
        if (settingsJson.data.appName) setAppName(settingsJson.data.appName);
        if (settingsJson.data.subTitle) setSubTitle(settingsJson.data.subTitle);
        if (settingsJson.data.logoUrl) setLogoUrl(settingsJson.data.logoUrl);
        if (settingsJson.data.kopUrl) {
          setKopUrl(settingsJson.data.kopUrl);
          if (typeof window !== 'undefined') localStorage.setItem('app_kop', settingsJson.data.kopUrl);
        }
      }
    } catch (err) {
      console.error('Gagal mengambil data pemilih:', err);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const localName = localStorage.getItem('app_name');
      const localSub = localStorage.getItem('app_subtitle');
      const localLogo = localStorage.getItem('app_logo');
      const localVoters = localStorage.getItem('voters_cache');

      if (localName) setAppName(localName);
      if (localSub) setSubTitle(localSub);
      if (localLogo) setLogoUrl(localLogo);
      if (localVoters) {
        try {
          const parsed = JSON.parse(localVoters);
          setVoters(parsed);
          setFilteredVoters(parsed);
        } catch {}
      }
    }

    fetchVotersData();
  }, []);

  // Synchronize filteredVoters & reset page to 1 whenever voters, searchTerm, or statusFilter changes
  useEffect(() => {
    setCurrentPage(1);
    let result = voters;

    // Filter berdasarkan status voting
    if (statusFilter === 'voted') {
      result = result.filter((v) => v.hasVoted === true);
    } else if (statusFilter === 'not_voted') {
      result = result.filter((v) => v.hasVoted === false);
    }

    // Filter berdasarkan kata kunci pencarian
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (v) =>
          v.nim.toLowerCase().includes(term) ||
          v.name.toLowerCase().includes(term)
      );
    }

    setFilteredVoters(result);
  }, [voters, searchTerm, statusFilter]);

  // Perhitungan Pagination Data
  const totalPages = Math.ceil(filteredVoters.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedVoters = filteredVoters.slice(indexOfFirstItem, indexOfLastItem);

  // Handler Cetak Kartu Akses TPS (Window Print Ready PDF Grid A4 Presisi Kompak)
  const handlePrintBatchCards = () => {
    const selectedVotersList = voters.filter((v) => selectedIds.includes(v.id));
    if (selectedVotersList.length === 0) return;

    const activeKopSrc = kopUrl || (typeof window !== 'undefined' ? localStorage.getItem('app_kop') || '' : '');
    const logoSrc = activeLogoSrc;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up terblokir oleh browser. Harap izinkan pop-up untuk mencetak kartu.');
      return;
    }

    const cardsHtml = selectedVotersList
      .map(
        (v) => {
          const activePass = v.randomPassword || v.password || 'X7K9A2';
          const qrPayload = JSON.stringify({ nim: v.nim, pass: activePass });
          return `
      <div class="voter-card">
        ${
          activeKopSrc
            ? `<div class="card-kop"><img src="${activeKopSrc}" alt="Kop Surat Resmi" /></div>`
            : `<div class="card-header">
                <img src="${logoSrc}" class="card-logo" />
                <div>
                  <div class="card-title">${appName}</div>
                  <div class="card-subtitle">KARTU AKSES PEMILIH TPS DIGITAL</div>
                </div>
              </div>`
        }
        <div class="card-body">
          <div class="voter-info">
            <div class="info-group">
              <span class="label">ID PEMILIH</span>
              <span class="value font-mono">${v.nim}</span>
            </div>
            <div class="info-group">
              <span class="label">NAMA PEMILIH</span>
              <span class="value font-name">${v.name}</span>
            </div>
            <div class="info-group">
              <span class="label">PASSWORD</span>
              <span class="value pass-code font-mono">${activePass}</span>
            </div>
          </div>
          <div class="qr-box">
            <canvas id="qr_canvas_${v.id}" class="qr-canvas" data-qr="${encodeURIComponent(qrPayload)}"></canvas>
          </div>
        </div>
        <div class="card-footer">
          <span>Panitia Pemilihan Pemungutan Suara • Kerahasiaan Hak Suara Terjamin • Powered by <strong>pancakalabs.my.id</strong></span>
        </div>
      </div>
    `;
        }
      )
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cetak Kartu Akses TPS - ${selectedVotersList.length} Pemilih</title>
          <style>
            @page { size: A4 portrait; margin: 6mm; }
            body { font-family: system-ui, -apple-system, sans-serif; background: #fff; margin: 0; padding: 0; color: #0f172a; }
            .grid-container { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6mm; }
            .voter-card { border: 1.5px solid #94a3b8; border-radius: 10px; padding: 8px 10px; background: #fff; box-shadow: none; page-break-inside: avoid; display: flex; flex-direction: column; justify-content: space-between; height: 50mm; position: relative; overflow: hidden; box-sizing: border-box; }
            .card-kop { border-bottom: 1px solid #cbd5e1; margin-bottom: 4px; padding-bottom: 2px; }
            .card-kop img { width: 100%; max-height: 14mm; object-fit: contain; display: block; margin: 0 auto; }
            .card-header { display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 4px; }
            .card-logo { height: 24px; width: auto; }
            .card-title { font-size: 11px; font-weight: 800; color: #0f172a; line-height: 1.1; }
            .card-subtitle { font-size: 8px; font-weight: 700; color: #059669; letter-spacing: 0.3px; }
            .card-body { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex: 1; }
            .voter-info { flex: 1; display: flex; flex-direction: column; gap: 3px; }
            .info-group { display: flex; flex-direction: column; }
            .label { font-size: 7px; font-weight: 700; color: #64748b; text-transform: uppercase; line-height: 1; }
            .value { font-size: 11px; font-weight: 800; color: #0f172a; line-height: 1.2; }
            .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
            .font-name { font-size: 10px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; }
            .pass-code { font-size: 11px; color: #047857; background: #ecfdf5; padding: 1px 5px; border-radius: 4px; border: 1px solid #a7f3d0; width: fit-content; display: inline-block; margin-top: 1px; }
            .qr-box { display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #e2e8f0; padding: 3px; border-radius: 8px; background: #f8fafc; shrink: 0; }
            .qr-canvas { width: 56px; height: 56px; display: block; }
            .qr-hint { font-size: 7px; color: #64748b; margin-top: 1px; }
            .card-footer { border-top: 1px dashed #cbd5e1; padding-top: 3px; margin-top: 3px; font-size: 7px; color: #64748b; display: flex; justify-content: space-between; font-weight: 600; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
          <script src="https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js"></script>
        </head>
        <body>
          <div class="grid-container">
            ${cardsHtml}
          </div>
          <script>
            function drawQRCodes() {
              document.querySelectorAll('.qr-canvas').forEach(function(canvas) {
                var rawData = decodeURIComponent(canvas.getAttribute('data-qr'));
                if (typeof QRious !== 'undefined') {
                  new QRious({
                    element: canvas,
                    value: rawData,
                    size: 150,
                    level: 'M'
                  });
                } else {
                  // Fallback ke QR Server API jika CDN QRious terhambat
                  var img = document.createElement('img');
                  img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(rawData);
                  img.className = 'qr-canvas';
                  canvas.parentNode.replaceChild(img, canvas);
                }
              });
            }

            window.onload = function() {
              drawQRCodes();
              setTimeout(function() { window.print(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    setIsPrintModalOpen(false);
  };

  // Handler Lock / Unlock Pemilih (Dengan Modal Pop-Up Premium)
  const [isLocking, setIsLocking] = useState(false);

  const handleLockVoters = (isLocked: boolean, target: 'unvoted' | 'all' | 'ids', customIds?: number[]) => {
    const targetIds = customIds || selectedIds;
    const targetCount = target === 'unvoted' 
      ? voters.filter(v => !v.hasVoted).length 
      : target === 'all' 
      ? voters.length 
      : targetIds.length;

    const title = isLocked ? 'Kunci / Nonaktifkan Login Pemilih' : 'Buka Kunci Login Pemilih';
    const description = isLocked
      ? target === 'unvoted'
        ? 'Apakah Anda yakin ingin KUNCI / NONAKTIFKAN semua akun mahasiswa yang BELUM MEMILIH? (Mahasiswa yang belum memilih tidak akan bisa login lagi saat TPS ditutup).'
        : `Apakah Anda yakin ingin KUNCI ${targetCount} akun pemilih terpilih?`
      : target === 'unvoted'
        ? 'Apakah Anda yakin ingin BUKA KUNCI semua akun mahasiswa yang BELUM MEMILIH?'
        : `Apakah Anda yakin ingin BUKA KUNCI ${targetCount} akun pemilih terpilih?`;

    setLockConfirmModal({
      isOpen: true,
      isLocked,
      target,
      ids: targetIds,
      title,
      description,
      count: targetCount,
    });
  };

  const executeLockProcess = async () => {
    if (!lockConfirmModal) return;
    const { isLocked, target, ids } = lockConfirmModal;
    setLockConfirmModal(null);

    setIsLocking(true);
    try {
      const res = await fetch('/api/voters', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isLocked,
          target,
          ids,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setLockResultModal({
          isOpen: true,
          isSuccess: false,
          title: 'Gagal Memperbarui Kunci',
          message: data.message || 'Gagal mengubah status kunci akun pemilih.',
        });
        return;
      }

      setLockResultModal({
        isOpen: true,
        isSuccess: true,
        title: isLocked ? 'Berhasil Mengunci Akun Pemilih' : 'Berhasil Membuka Kunci Pemilih',
        message: data.message || `Berhasil memperbarui status kunci ${data.updatedCount || 0} pemilih.`,
        count: data.updatedCount || 0,
      });
      fetchVotersData();
    } catch (err) {
      setLockResultModal({
        isOpen: true,
        isSuccess: false,
        title: 'Kesalahan Koneksi',
        message: 'Terjadi kesalahan koneksi saat memperbarui status kunci pemilih.',
      });
    } finally {
      setIsLocking(false);
    }
  };

  // Handler Export Data Pemilih ke Excel (.xlsx)
  const handleExportExcel = async (exportAll: boolean = false) => {
    const listToExport = exportAll ? filteredVoters : voters.filter((v) => selectedIds.includes(v.id));
    if (listToExport.length === 0) return;

    try {
      const XLSXLib = await loadXlsxScript();
      
      const exportData = listToExport.map((v, index) => ({
        'No': index + 1,
        'ID Pemilih (NIM/NIK)': v.nim,
        'Nama Pemilih': v.name,
        'Password Acak TPS': v.randomPassword || v.password || '—',
        'Status Voting': v.hasVoted ? 'Sudah Memilih' : 'Belum Memilih',
      }));

      const worksheet = XLSXLib.utils.json_to_sheet(exportData);
      
      // Mengatur lebar kolom otomatis agar rapi
      worksheet['!cols'] = [
        { wch: 6 },
        { wch: 22 },
        { wch: 30 },
        { wch: 20 },
        { wch: 18 },
      ];

      const workbook = XLSXLib.utils.book_new();
      XLSXLib.utils.book_append_sheet(workbook, worksheet, 'Daftar Pemilih TPS');

      const fileName = `Daftar_Pemilih_TPS_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSXLib.writeFile(workbook, fileName);
    } catch (err) {
      console.error('Gagal mengeksport file Excel:', err);
      alert('Gagal membuat file Excel. Pastikan koneksi internet stabil.');
    }
  };

  // Manual Input State
  const [newNim, setNewNim] = useState('');
  const [newName, setNewName] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const localName = localStorage.getItem('app_name');
      const localLogo = localStorage.getItem('app_logo');

      if (localName) setAppName(localName);
      if (localLogo) setLogoUrl(localLogo);
    }
  }, []);



  // Filter Search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredVoters(voters);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredVoters(
        voters.filter(
          (v) =>
            v.nim.toLowerCase().includes(term) ||
            v.name.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, voters]);

  // Select all checkbox
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredVoters.map((v) => v.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Simpan Pemilih Baru
  const handleSaveManualVoter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNim.trim() || !newName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/voters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nim: newNim.trim(), name: newName.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.message || 'Gagal menambah pemilih baru.');
        setIsSubmitting(false);
        return;
      }

      setNewNim('');
      setNewName('');
      setIsAddModalOpen(false);
      fetchVotersData();
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hapus Pemilih Batch
  const handleDeleteBatch = async () => {
    if (selectedIds.length === 0) return;

    try {
      const res = await fetch('/api/voters', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json();

      if (res.ok) {
        setSelectedIds([]);
        setIsDeleteConfirmOpen(false);
        fetchVotersData();
      } else {
        alert(data.message || 'Gagal menghapus data pemilih.');
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    }
  };

  // Edit Data Pemilih (NIM, Nama, Password)
  const handleOpenEditModal = (voter: Voter) => {
    setEditingVoter(voter);
    setEditNim(voter.nim);
    setEditName(voter.name);
    setEditPassword(voter.randomPassword || voter.password || '');
    setIsEditModalOpen(true);
  };

  const handleSaveEditVoter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVoter || !editNim.trim() || !editName.trim()) return;

    setIsSubmittingEdit(true);
    try {
      const res = await fetch('/api/voters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingVoter.id,
          nim: editNim.trim(),
          name: editName.trim(),
          password: editPassword.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.message || 'Gagal memperbarui data pemilih.');
        setIsSubmittingEdit(false);
        return;
      }

      setIsEditModalOpen(false);
      setEditingVoter(null);
      fetchVotersData();
    } catch (err) {
      alert('Terjadi kesalahan koneksi saat memperbarui data pemilih.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const activeLogoSrc = logoUrl || '/images/default-logo.png';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
      {/* Header Admin */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <img
            src={activeLogoSrc}
            alt="Logo"
            className="h-9 w-auto object-contain shrink-0"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">
              {appName} - Manajemen Pemilih & Cetak Kartu
            </h1>
            <p className="text-xs text-slate-500">{subTitle}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Tombol Kembali ke Dashboard */}
        <div className="flex justify-between items-center">
          <Link
            href="/admin/dashboard"
            className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-2 border border-slate-200 shadow-sm transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard</span>
          </Link>
        </div>

        {/* Top Control Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4 shadow-md">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Tambah Data Pemilih</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Gunakan fitur Bulk Upload Excel atau Tambah Manual 1 per 1 di bawah ini.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            <button
              onClick={() => handleLockVoters(true, 'unvoted')}
              disabled={isLocking}
              className="flex-1 md:flex-none px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-amber-200 transition shadow-sm disabled:opacity-50"
              title="Kunci / Nonaktifkan semua akun mahasiswa yang belum memilih saat TPS ditutup"
            >
              <Lock className="w-4 h-4 text-amber-600" />
              <span>Kunci Akun Belum Memilih ({voters.filter(v => !v.hasVoted).length})</span>
            </button>
            <button
              onClick={() => handleLockVoters(false, 'unvoted')}
              disabled={isLocking}
              className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-emerald-200 transition shadow-sm disabled:opacity-50"
              title="Buka kembali kunci akses login semua akun mahasiswa yang belum memilih"
            >
              <Unlock className="w-4 h-4 text-emerald-600" />
              <span>Buka Kunci</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex-1 md:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-200 transition shadow-sm"
            >
              <UserPlus className="w-4 h-4 text-emerald-600" />
              <span>Tambah Manual</span>
            </button>
            <button
              onClick={() => {
                setExcelErrorMsg('');
                setExcelFile(null);
                setIsExcelModalOpen(true);
              }}
              className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-md shadow-emerald-600/20"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Excel</span>
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" />
          </div>
        </div>

        {/* Tabel Data Pemilih */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-slate-900">
                Daftar Pemilih ({filteredVoters.length})
              </h3>

              {selectedIds.length > 0 && (
                <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-lg">
                  {selectedIds.length} Dipilih
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
              {/* Batch Action Buttons */}
              {selectedIds.length > 0 && (
                <>
                  <button
                    onClick={() => setIsPrintModalOpen(true)}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs border border-emerald-200 transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak Kartu ({selectedIds.length})</span>
                  </button>
                  <button
                    onClick={() => handleExportExcel(false)}
                    className="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-xl text-xs border border-teal-200 transition flex items-center gap-1.5 shadow-sm"
                    title="Download Data Pemilih Terpilih ke Format Excel (.xlsx)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Cetak Excel ({selectedIds.length})</span>
                  </button>
                  <button
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-xs border border-red-200 transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus ({selectedIds.length})</span>
                  </button>
                </>
              )}

              {/* Dropdown Filter Status Voting */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'voted' | 'not_voted')}
                  className="pl-8 pr-7 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition shadow-inner font-bold cursor-pointer appearance-none"
                >
                  <option value="all">Semua Status ({voters.length})</option>
                  <option value="voted">Sudah Memilih ({voters.filter(v => v.hasVoted).length})</option>
                  <option value="not_voted">Belum Memilih ({voters.filter(v => !v.hasVoted).length})</option>
                </select>
                <Filter className="w-3.5 h-3.5 text-emerald-600 absolute left-2.5 top-2.5 pointer-events-none" />
                <div className="absolute right-2.5 top-3 pointer-events-none text-slate-400 text-[10px]">▼</div>
              </div>

              {/* Search Field Kolom Pencarian DPT */}
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-emerald-600 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari berdasarkan ID Pemilih atau Nama..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition shadow-inner font-medium"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 transition"
                    title="Bersihkan Pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider">
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={
                        filteredVoters.length > 0 &&
                        selectedIds.length === filteredVoters.length
                      }
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                  </th>
                  <th className="p-3.5 text-left font-semibold">ID Pemilih</th>
                  <th className="p-3.5 text-left font-semibold">Nama Pemilih</th>
                  <th className="p-3.5 text-left font-semibold">Password Acak TPS</th>
                  <th className="p-3.5 text-center font-semibold">Status Voting</th>
                  <th className="p-3.5 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      <div className="inline-flex items-center gap-2">
                        <LoaderCircle className="w-4 h-4 animate-spin text-emerald-600" />
                        <span>Memuat data pemilih...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredVoters.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      Belum ada data pemilih terdaftar. Silakan tambah manual atau upload Excel.
                    </td>
                  </tr>
                ) : (
                  paginatedVoters.map((voter) => (
                    <tr key={voter.id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(voter.id)}
                          onChange={() => handleSelectRow(voter.id)}
                          className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                        />
                      </td>
                      <td className="p-3.5 font-mono text-slate-600 font-semibold">{voter.nim}</td>
                      <td className="p-3.5 font-bold text-slate-900">{voter.name}</td>
                      <td className="p-3.5 font-mono text-emerald-600 font-bold tracking-wider">
                        {voter.randomPassword || voter.password || '—'}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {voter.hasVoted ? (
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-[10px]">
                              Sudah Memilih
                            </span>
                          ) : voter.isLocked ? (
                            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold text-[10px] flex items-center gap-1">
                              <Lock className="w-3 h-3 text-amber-600" />
                              <span>Terkunci</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full font-semibold text-[10px]">
                              Belum Memilih
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!voter.hasVoted && (
                            <button
                              onClick={() => handleLockVoters(!voter.isLocked, 'ids', [voter.id])}
                              className={`p-1.5 rounded-lg transition border ${
                                voter.isLocked
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200'
                                  : 'bg-amber-50 hover:bg-amber-100 text-amber-600 border-amber-200'
                              }`}
                              title={voter.isLocked ? 'Buka Kunci Akun' : 'Kunci / Nonaktifkan Login Akun'}
                            >
                              {voter.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditModal(voter)}
                            className="p-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 rounded-lg transition border border-slate-200"
                            title="Edit Data Pemilih (NIM & Nama)"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedIds([voter.id]);
                              setIsDeleteConfirmOpen(true);
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg transition border border-slate-200"
                            title="Hapus Pemilih"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls Footer Bar */}
          {filteredVoters.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-200 text-xs text-slate-600">
              <div className="flex items-center gap-3">
                <span>
                  Menampilkan{' '}
                  <strong className="text-slate-900 font-bold">
                    {filteredVoters.length === 0 ? 0 : indexOfFirstItem + 1}
                  </strong>{' '}
                  -{' '}
                  <strong className="text-slate-900 font-bold">
                    {Math.min(indexOfLastItem, filteredVoters.length)}
                  </strong>{' '}
                  dari <strong className="text-slate-900 font-bold">{filteredVoters.length}</strong> data pemilih
                </span>

                <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                  <span className="text-slate-500 text-[11px]">Tampilkan per halaman:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {/* Page Number Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Sebelumnya</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      return (
                        page === 1 ||
                        page === totalPages ||
                        Math.abs(page - currentPage) <= 1
                      );
                    })
                    .map((page, index, array) => {
                      const prevPage = array[index - 1];
                      const showEllipsis = prevPage && page - prevPage > 1;

                      return (
                        <div key={page} className="flex items-center gap-1">
                          {showEllipsis && <span className="px-1 text-slate-400 font-bold">...</span>}
                          <button
                            onClick={() => setCurrentPage(page)}
                            className={`min-w-[32px] h-[32px] px-2 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                              currentPage === page
                                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                                : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            {page}
                          </button>
                        </div>
                      );
                    })}
                </div>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
                >
                  <span className="hidden sm:inline">Berikutnya</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL: Tambah Pemilih Manual */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-900">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Tambah Pemilih Manual</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveManualVoter} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ID Pemilih</label>
                <input
                  type="text"
                  required
                  value={newNim}
                  onChange={(e) => setNewNim(e.target.value)}
                  placeholder="Contoh: 1001 atau NIK/ID Pemilih"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap Pemilih</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Masukkan nama lengkap pemilih"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition border border-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Data Pemilih'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Data Pemilih */}
      {isEditModalOpen && editingVoter && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-900">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Data Pemilih</h3>
                  <p className="text-[11px] text-slate-500">Ubah ID/NIM, Nama, atau Password TPS</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditVoter} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ID / NIM Pemilih</label>
                <input
                  type="text"
                  required
                  value={editNim}
                  onChange={(e) => setEditNim(e.target.value)}
                  placeholder="Masukkan ID / NIM Pemilih"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap Pemilih</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Masukkan nama lengkap pemilih"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password TPS Pemilih</label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Password acak kartu akses"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 font-mono font-bold text-emerald-700 tracking-wider"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition border border-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isSubmittingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Konfirmasi Hapus Batch */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-center text-slate-900">
            <div className="inline-flex p-3 bg-red-50 border border-red-200 rounded-2xl text-red-600">
              <Trash2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Konfirmasi Hapus Data</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Apakah Anda yakin ingin menghapus <strong className="text-red-600">{selectedIds.length} data pemilih</strong> terpilih? Data yang dihapus tidak dapat dikembalikan.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition border border-slate-200"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteBatch}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition shadow-md shadow-red-600/20"
              >
                Hapus Permanent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Konfirmasi Cetak Kartu Batch */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-center text-slate-900">
            <div className="inline-flex p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-600">
              <Printer className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Cetak Kartu Akses TPS</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Sistem akan membangkitkan dokumen PDF Grid A4 berisi Kartu Akses & QR Code untuk <strong className="text-emerald-600">{selectedIds.length} pemilih terpilih</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition border border-slate-200"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  handleExportExcel(false);
                  setIsPrintModalOpen(false);
                }}
                className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs transition shadow-md shadow-teal-600/20 flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Cetak Excel</span>
              </button>
              <button
                type="button"
                onClick={handlePrintBatchCards}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL POPUP PREMIUM: UPLOAD FILE EXCEL & DOWNLOAD TEMPLATE */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 text-slate-900 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Ambient Accent Glow */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />

            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-2xl shadow-inner">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Upload Bulk Pemilih dari Excel
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Import ratusan data pemilih sekaligus dengan format tabel (.xlsx / .csv)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExcelModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1: Download Template Button */}
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-emerald-900 block">
                  Belum Memiliki Format File Excel?
                </span>
                <p className="text-[11px] text-emerald-700">
                  Unduh file template resmi Excel (<code className="font-bold text-emerald-800">format_template_daftar_pemilih.xlsx</code>).
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0 shadow-sm transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Template .XLSX</span>
              </button>
            </div>

            {/* Step 2: Drag & Drop File Picker Box */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Pilih atau Tarik File Excel Ke Sini
              </label>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDropExcel}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full min-h-[160px] border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
                    : excelFile
                    ? 'border-emerald-500 bg-emerald-50/20'
                    : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50'
                }`}
              >
                {excelFile ? (
                  <div className="flex flex-col items-center space-y-2">
                    <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                      <FileText className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 max-w-[280px] truncate">
                      {excelFile.name}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded">
                      {(excelFile.size / 1024).toFixed(1)} KB • Siap Di-Import
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-2">
                    <div className="p-3 bg-slate-100 text-slate-500 rounded-xl group-hover:text-emerald-600 transition">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Tarik & Lepaskan File Excel di sini
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5 block">
                        atau klik untuk memilih file dari komputer (.xlsx, .xls, .csv)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleSelectExcelFile}
                className="hidden"
                accept=".xlsx, .xls, .csv"
              />
            </div>

            {/* Error Message */}
            {excelErrorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{excelErrorMsg}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsExcelModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition border border-slate-200"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!excelFile || isUploadingExcel}
                onClick={handleProcessExcelUpload}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploadingExcel ? (
                  <>
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                    <span>Mengimport Data...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Proses Import & Simpan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LAPORAN HASIL REKAPITULASI IMPORT EXCEL */}
      {importResultModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 text-slate-900 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header Laporan */}
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-200 shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                Laporan Hasil Import Excel
              </h3>
              <p className="text-xs text-slate-500">
                Ringkasan rekapitulasi data dari total <strong className="text-slate-800">{importResultModal.total} baris</strong> yang diproses.
              </p>
            </div>

            {/* Kartu Ringkasan Statistik 3 Kolom */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              {/* Berhasil */}
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl space-y-1 shadow-sm">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Berhasil
                </span>
                <span className="text-xl font-black text-emerald-600">
                  {importResultModal.successCount}
                </span>
                <span className="text-[9px] text-emerald-700 block">Data Masuk</span>
              </div>

              {/* Duplikat / Sama */}
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl space-y-1 shadow-sm">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                  Sama/Duplikat
                </span>
                <span className="text-xl font-black text-amber-600">
                  {importResultModal.duplicateCount}
                </span>
                <span className="text-[9px] text-amber-700 block">Dilewati</span>
              </div>

              {/* Gagal */}
              <div className="bg-red-50 border border-red-200 p-3 rounded-2xl space-y-1 shadow-sm">
                <span className="text-[10px] font-bold text-red-800 uppercase tracking-wider block">
                  Gagal
                </span>
                <span className="text-xl font-black text-red-600">
                  {importResultModal.failedCount}
                </span>
                <span className="text-[9px] text-red-700 block">Format Salah</span>
              </div>
            </div>

            {/* Detail List Data Duplikat Jika Ada */}
            {importResultModal.duplicateList.length > 0 && (
              <div className="space-y-1.5 text-left">
                <span className="text-xs font-bold text-amber-800 block">
                  Daftar ID Pemilih Duplikat (Dilewati):
                </span>
                <div className="max-h-36 overflow-y-auto border border-amber-200 bg-amber-50/80 rounded-xl p-3 text-[11px] font-mono text-amber-900 space-y-1.5 shadow-inner select-text">
                  {importResultModal.duplicateList.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 py-0.5 border-b border-amber-200/50 last:border-0">
                      <span className="text-amber-500 font-bold">•</span>
                      <span className="truncate">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info Petunjuk Klik Refresh Data */}
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5 text-left">
              <RefreshCw className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-800 leading-snug">
                Data berhasil diproses ke database. Jika data baru belum muncul di tabel, silakan klik tombol <strong>Refresh Data</strong> di bawah.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={async () => {
                  await fetchVotersData();
                  setImportResultModal(null);
                }}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-lg flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Data
              </button>
              <button
                type="button"
                onClick={() => setImportResultModal(null)}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PREMIUM: Konfirmasi Kunci / Buka Akses Pemilih */}
      {lockConfirmModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 text-slate-900 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Ambient Accent Glow */}
            <div className={`absolute top-0 right-0 w-36 h-36 blur-3xl rounded-full pointer-events-none ${lockConfirmModal.isLocked ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`} />

            <div className="flex flex-col items-center text-center space-y-3">
              <div className={`p-4 rounded-2xl border shadow-inner ${lockConfirmModal.isLocked ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                {lockConfirmModal.isLocked ? <Lock className="w-8 h-8" /> : <Unlock className="w-8 h-8" />}
              </div>
              <h3 className="text-lg font-black text-slate-900">
                {lockConfirmModal.title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {lockConfirmModal.description}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex justify-between items-center text-xs font-semibold">
              <span className="text-slate-500">Total Akun Terpengaruh:</span>
              <span className={`font-mono font-bold px-2.5 py-1 rounded-lg border ${lockConfirmModal.isLocked ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}`}>
                {lockConfirmModal.count} Mahasiswa
              </span>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setLockConfirmModal(null)}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition border border-slate-200"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeLockProcess}
                disabled={isLocking}
                className={`flex-1 py-3 px-4 font-bold rounded-xl text-xs transition shadow-lg flex items-center justify-center gap-2 text-white ${
                  lockConfirmModal.isLocked
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                }`}
              >
                {isLocking ? (
                  <>
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    {lockConfirmModal.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    <span>Ya, {lockConfirmModal.isLocked ? 'Kunci Sekarang' : 'Buka Kunci'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PREMIUM: Hasil / Notifikasi Kunci & Buka Akses Pemilih */}
      {lockResultModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 text-slate-900 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Ambient Accent Glow */}
            <div className={`absolute top-0 right-0 w-36 h-36 blur-3xl rounded-full pointer-events-none ${lockResultModal.isSuccess ? 'bg-emerald-500/10' : 'bg-red-500/10'}`} />

            <div className="flex flex-col items-center text-center space-y-3">
              <div className={`p-4 rounded-2xl border shadow-inner ${lockResultModal.isSuccess ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-red-50 border-red-200 text-red-600'}`}>
                {lockResultModal.isSuccess ? <CheckCircle2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
              </div>
              <h3 className="text-lg font-black text-slate-900">
                {lockResultModal.title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {lockResultModal.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setLockResultModal(null)}
              className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition shadow-lg"
            >
              Mengerti &amp; Tutup
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full text-center py-4 text-xs text-slate-500 flex justify-center items-center flex-wrap gap-2 px-6">
        <span>© 2026 Admin TPS E-Voting</span>
        <span>•</span>
        <span>
          Powered by{' '}
          <a
            href="https://pancakalabs.my.id"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-emerald-600 hover:underline"
          >
            Pancakalabs
          </a>
        </span>
      </footer>
    </div>
  );
}
