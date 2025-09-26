import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Table, 
  Button, 
  Form, 
  InputGroup, 
  Badge, 
  Dropdown,
  Modal,
  Alert,
  Pagination
} from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { 
  FiPlus, 
  FiSearch, 
  FiEdit, 
  FiX, 
  FiRefreshCw, 
  FiMoreVertical,
  FiUser,
  FiDollarSign,
  FiTrash2,
  FiFilter,
  FiCalendar,
  FiFileText,
  FiClock,
  FiEdit3,
  FiChevronUp,
  FiChevronDown
} from 'react-icons/fi';

import { salesAPI, primsAPI, usersAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { 
  formatCurrency, 
  formatDate, 
  getSaleStatusBadgeClass, 
  getPrimStatusBadgeClass,
  getPaymentTypeClass,
  debounce 
} from '../../utils/helpers';

import TransferModal from './TransferModal';
import NotesModal from './NotesModal';
import ConvertToSaleModal from './ConvertToSaleModal';
import ModifySaleModal from './ModifySaleModal';
import ModificationHistoryModal from './ModificationHistoryModal';
import PrimTransactionStatusModal from './PrimTransactionStatusModal';
import Loading from '../Common/Loading';

const SalesList = () => {
  const [sales, setSales] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    period: '',
    page: 1,
    limit: 20,
    primStatus: '', // 'ödendi', 'ödenmedi', ''
    startDate: '',
    endDate: '',
    salesperson: '', // temsilci filtresi
    status: 'aktif' // Sadece aktif satışları göster (iptal edilenleri gizle)
  });
  const [sorting, setSorting] = useState({
    field: 'effectiveDate', // karma tarih sıralaması (saleDate + kaporaDate)
    direction: 'desc' // 'asc' veya 'desc'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    totalPages: 1,
    currentPage: 1,
    total: 0
  });

  // Modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showPrimStatusModal, setShowPrimStatusModal] = useState(false);
  
  // Cancel modal state
  const [cancelReason, setCancelReason] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [selectedPrimTransaction, setSelectedPrimTransaction] = useState(null);

  const { user } = useAuth();
  const isAdmin = user?.role && user.role.name === 'admin';

  useEffect(() => {
    fetchPeriods();
    fetchUsers(); // Tüm kullanıcılar temsilci listesini görebilir
  }, []);

  useEffect(() => {
    const debouncedFetch = debounce(fetchSales, 500);
    debouncedFetch();
  }, [filters, sorting]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const params = {
        ...filters,
        primPeriod: filters.period, // period → primPeriod
        sortBy: sorting.field,
        sortOrder: sorting.direction
      };
      
      // period parametresini kaldır (çünkü primPeriod olarak gönderiyoruz)
      delete params.period;
      
      console.log('📋 Sales API params:', params);
      const response = await salesAPI.getSales(params);
      console.log('📋 Sales fetch response:', response.data);
      console.log('📋 First sale in response:', response.data.sales?.[0]);
      console.log('📋 First sale modificationHistory:', response.data.sales?.[0]?.modificationHistory);
      
      // DENEME DENEME satışını özellikle logla
      const denemeUser = response.data.sales?.find(s => s.customerName === 'DENEME DENEME');
      if (denemeUser) {
        console.log('🎯 DENEME DENEME satışı detayları:', {
          listPrice: denemeUser.listPrice,
          originalListPrice: denemeUser.originalListPrice,
          activitySalePrice: denemeUser.activitySalePrice,
          primAmount: denemeUser.primAmount,
          hasModifications: denemeUser.hasModifications,
          modificationHistory: denemeUser.modificationHistory
        });
      }

      // Modification history kontrolü için ilk satışı logla
      const firstSale = response.data.sales?.[0];
      if (firstSale) {
        console.log('🔍 First sale modification check:', {
          customerName: firstSale.customerName,
          hasModifications: firstSale.hasModifications,
          isModified: firstSale.isModified,
          modificationHistoryLength: firstSale.modificationHistory?.length,
          salespersonId: firstSale.salesperson?._id,
          currentUserId: user?._id,
          isAdmin: isAdmin,
          showHistoryButton: (firstSale.hasModifications || firstSale.isModified) && (isAdmin || firstSale.salesperson?._id === user?._id)
        });
      }
      setSales(response.data.sales || []);
      setPagination({
        totalPages: response.data.totalPages || 1,
        currentPage: response.data.currentPage || 1,
        total: response.data.total || 0
      });
      setError(null);
    } catch (error) {
      console.error('Sales fetch error:', error);
      setError('Satışlar yüklenirken hata oluştu');
      toast.error('Satışlar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const fetchPeriods = async () => {
    try {
      const response = await primsAPI.getPeriods();
      setPeriods(response.data || []);
    } catch (error) {
      console.error('Periods fetch error:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await usersAPI.getUsersForFilters(); // Tüm kullanıcılar erişebilir
      setUsers(response.data || []);
    } catch (error) {
      console.error('Users fetch error:', error);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      page: 1 // Reset to first page when filtering
    }));
  };

  const handlePageChange = (page) => {
    setFilters(prev => ({
      ...prev,
      page
    }));
  };

  const handleSort = (field) => {
    setSorting(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    // Sayfa 1'e dön sıralama değiştiğinde
    setFilters(prev => ({
      ...prev,
      page: 1
    }));
  };

  const getSortIcon = (field) => {
    if (sorting.field !== field) {
      return <span className="text-muted ms-1" style={{ opacity: 0.3 }}>⇅</span>;
    }
    return sorting.direction === 'asc' 
      ? <FiChevronUp className="ms-1 text-primary" />
      : <FiChevronDown className="ms-1 text-primary" />;
  };

  const handleCancelSale = async () => {
    if (!selectedSale) return;
    
    // İptal nedeni zorunlu kontrolü
    if (!cancelReason.trim()) {
      toast.error('İptal nedeni belirtilmesi zorunludur');
      return;
    }

    try {
      // Önce satışı iptal et
      await salesAPI.cancelSale(selectedSale._id);
      
      // Sonra iptal nedenini notlara ekle
      const existingNotes = selectedSale.notes || '';
      const cancelNote = `[İPTAL NEDENI - ${new Date().toLocaleDateString('tr-TR')}]: ${cancelReason.trim()}`;
      const newNotes = existingNotes 
        ? `${existingNotes}\n\n${cancelNote}`
        : cancelNote;
      
      await salesAPI.updateNotes(selectedSale._id, newNotes);
      
      toast.success('Satış başarıyla iptal edildi ve iptal nedeni notlara eklendi');
      fetchSales();
      setShowCancelModal(false);
      setSelectedSale(null);
      setCancelReason('');
    } catch (error) {
      console.error('Cancel sale error:', error);
      toast.error(error.response?.data?.message || 'Satış iptal edilirken hata oluştu');
    }
  };

  const handlePrimStatusChange = async (saleId, newStatus) => {
    try {
      await salesAPI.updatePrimStatus(saleId, newStatus);
      toast.success('Prim durumu güncellendi');
      fetchSales();
    } catch (error) {
      console.error('Update prim status error:', error);
      toast.error(error.response?.data?.message || 'Prim durumu güncellenirken hata oluştu');
    }
  };

  const openCancelModal = (sale) => {
    setSelectedSale(sale);
    setCancelReason(''); // Reset cancel reason
    setShowCancelModal(true);
  };

  const openTransferModal = (sale) => {
    setSelectedSale(sale);
    setShowTransferModal(true);
  };

  const openNotesModal = (sale) => {
    setSelectedSale(sale);
    setShowNotesModal(true);
  };

  const openConvertModal = (sale) => {
    setSelectedSale(sale);
    setShowConvertModal(true);
  };

  const openModifyModal = (sale) => {
    setSelectedSale(sale);
    setShowModifyModal(true);
  };

  const openHistoryModal = (sale) => {
    setSelectedSale(sale);
    setShowHistoryModal(true);
  };

  const handleDeleteSale = async (sale) => {
    const confirmMessage = `Bu satışı kalıcı olarak silmek istediğinizden emin misiniz?\n\nSilinecek Satış:\n• Müşteri: ${sale.customerName}\n• Sözleşme No: ${sale.contractNo}\n• Prim Tutarı: ${formatCurrency(sale.primAmount)}\n\nBu işlem GERİ ALINAMAZ!`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await salesAPI.deleteSale(sale._id);
      toast.success('Satış başarıyla silindi');
      fetchSales();
    } catch (error) {
      console.error('Delete sale error:', error);
      toast.error(error.response?.data?.message || 'Satış silinirken hata oluştu');
    }
  };

  if (loading && sales.length === 0) {
    return <Loading variant="pulse" size="large" />;
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>Satışlar</h1>
          <p className="text-muted mb-0">
            Toplam {pagination.total} satış
          </p>
        </div>
        <Link to="/sales/new" className="btn btn-primary">
          <FiPlus className="me-2" />
          Yeni Satış
        </Link>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <Card.Body>
          <Row>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Arama</Form.Label>
                <InputGroup>
                  <InputGroup.Text>
                    <FiSearch />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Müşteri adı, sözleşme no, blok/daire ara..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                  />
                </InputGroup>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Dönem</Form.Label>
                <Form.Select
                  value={filters.period}
                  onChange={(e) => handleFilterChange('period', e.target.value)}
                >
                  <option value="">Tüm Dönemler</option>
                  {periods.map(period => (
                    <option key={period._id} value={period._id}>
                      {period.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>&nbsp;</Form.Label>
                <div className="d-flex gap-2">
                  <Button 
                    variant="outline-primary" 
                    onClick={() => setShowFilters(!showFilters)}
                    size="sm"
                  >
                    <FiFilter />
                  </Button>
                  <Button variant="outline-secondary" onClick={fetchSales} disabled={loading}>
                    <FiRefreshCw className={loading ? 'spin' : ''} />
                  </Button>
                </div>
              </Form.Group>
            </Col>
          </Row>

          {/* Advanced Filters */}
          {showFilters && (
            <>
              <hr />
              <Row>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Temsilci</Form.Label>
                    <Form.Select
                      value={filters.salesperson}
                      onChange={(e) => handleFilterChange('salesperson', e.target.value)}
                    >
                      <option value="">Tüm Temsilciler</option>
                      {users.map(user => (
                        <option key={user._id} value={user._id}>
                          {user.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Prim Durumu</Form.Label>
                    <Form.Select
                      value={filters.primStatus}
                      onChange={(e) => handleFilterChange('primStatus', e.target.value)}
                    >
                      <option value="">Tüm Durumlar</option>
                      <option value="ödendi">Prim Ödendi</option>
                      <option value="ödenmedi">Prim Ödenmedi</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Başlangıç Tarihi</Form.Label>
                    <Form.Control
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Bitiş Tarihi</Form.Label>
                    <Form.Control
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>&nbsp;</Form.Label>
                    <div>
                                          <Button 
                        variant="outline-warning" 
                        size="sm"
                        onClick={() => setFilters({ 
                          search: '', 
                          period: '', 
                          page: 1, 
                          limit: 10,
                          primStatus: '',
                          startDate: '',
                          endDate: '',
                          salesperson: ''
                        })}
                      >
                        Filtreleri Temizle
                      </Button>
                    </div>
                  </Form.Group>
                </Col>
              </Row>
            </>
          )}
        </Card.Body>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Sales Table */}
      <Card>
        <Card.Body className="p-0">
          {sales.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-muted">Henüz satış bulunamadı.</p>
              <Link to="/sales/new" className="btn btn-primary">
                İlk Satışınızı Ekleyin
              </Link>
            </div>
          ) : (
            <>
              <Table responsive hover className="mb-0">
                <thead>
                  <tr>
                    <th 
                      onClick={() => handleSort('customerName')} 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      className="sortable-header"
                    >
                      Müşteri {getSortIcon('customerName')}
                    </th>
                    <th>Konum</th>
                    <th 
                      onClick={() => handleSort('contractNo')} 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      className="sortable-header"
                    >
                      Sözleşme No {getSortIcon('contractNo')}
                    </th>
                    <th 
                      onClick={() => handleSort('saleType')} 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      className="sortable-header"
                    >
                      Tür {getSortIcon('saleType')}
                    </th>
                    <th 
                      onClick={() => handleSort('saleDate')} 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      className="sortable-header"
                    >
                      Tarih {getSortIcon('saleDate')}
                    </th>
                    <th 
                      onClick={() => handleSort('basePrimPrice')} 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      className="sortable-header"
                    >
                      Fiyatlar {getSortIcon('basePrimPrice')}
                    </th>
                    <th 
                      onClick={() => handleSort('primAmount')} 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      className="sortable-header"
                    >
                      Prim {getSortIcon('primAmount')}
                    </th>
                    <th 
                      onClick={() => handleSort('status')} 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      className="sortable-header"
                    >
                      Durum {getSortIcon('status')}
                    </th>
                    <th 
                      onClick={() => handleSort('salesperson')} 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      className="sortable-header"
                    >
                      Temsilci {getSortIcon('salesperson')}
                    </th>
                    <th>Notlar</th>
                    <th>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale._id}>
                      <td>
                        <div className="d-flex align-items-start">
                          <div className="flex-grow-1">
                            <strong>{sale.customerName}</strong>
                            {sale.isModified && (
                              <FiEdit3 
                                className="ms-2 text-warning" 
                                size={14}
                                style={{ cursor: 'pointer' }}
                                title="Bu satış değiştirilmiş - Geçmişi görüntülemek için tıklayın"
                                onClick={() => openHistoryModal(sale)}
                              />
                            )}
                            <br />
                            {sale.phone && (
                              <small className="text-primary fw-bold">
                                📞 {sale.phone}
                              </small>
                            )}
                            {sale.phone && <br />}
                            <small className="text-muted">
                              Dönem: {sale.periodNo}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>
                          Blok: {sale.blockNo}
                          <br />
                          Daire: {sale.apartmentNo}
                        </div>
                      </td>
                      <td>
                        <code>{sale.contractNo}</code>
                      </td>
                      <td>
                        <Badge 
                          bg={(() => {
                            // Kapora için özel renk
                            if (sale.saleType === 'kapora') return 'warning';
                            // SaleType objesinden renk al, yoksa varsayılan
                            return sale.saleTypeDetails?.color || 'success';
                          })()} 
                          className="mb-1"
                        >
                          {sale.saleTypeName || (sale.saleType === 'kapora' ? 'Kapora Durumu' : 'Satış')}
                        </Badge>
                      </td>
                      <td>
                        {sale.saleType === 'kapora' 
                          ? formatDate(sale.kaporaDate)
                          : formatDate(sale.saleDate)
                        }
                        <br />
                        <small className="text-muted">
                          {sale.saleType === 'kapora' ? 'Kapora' : 'Satış'} Tarihi
                        </small>
                      </td>
                      <td>
                        <div>
                          {/* Liste Fiyatı - Kapora dahil tüm türler için */}
                          <div>
                            <strong>Liste: {formatCurrency(sale.originalListPrice || sale.listPrice)}</strong>
                            {sale.saleType === 'kapora' && (
                              <Badge bg="warning" className="ms-1" style={{ fontSize: '0.6rem' }}>
                                Kapora
                              </Badge>
                            )}
                          </div>
                          
                          {/* İndirim Varsa Göster - Kapora dışında */}
                          {sale.saleType !== 'kapora' && sale.discountRate > 0 && (
                            <div>
                              <small className="text-success">
                                İndirimli: {formatCurrency(sale.discountedListPrice || (sale.listPrice * (1 - sale.discountRate / 100)))}
                              </small>
                              <Badge bg="success" className="ms-1" style={{ fontSize: '0.6rem' }}>
                                %{sale.discountRate} İndirim
                              </Badge>
                            </div>
                          )}
                          
                          {/* Aktivite Fiyatı - Kapora dışında */}
                          {sale.saleType !== 'kapora' && (
                            <div>
                              <small>Aktivite: {formatCurrency(sale.activitySalePrice)}</small>
                            </div>
                          )}
                          
                          {/* Prim Hesaplama Tabanı - Kapora dışında */}
                          {sale.saleType !== 'kapora' && (
                            <div>
                              <small className="text-info">
                                Prim Tabanı: {(() => {
                                  const originalListPrice = sale.originalListPrice || sale.listPrice || 0;
                                  const discountedPrice = sale.discountedListPrice || (sale.discountRate > 0 ? originalListPrice * (1 - sale.discountRate / 100) : 0);
                                  const activityPrice = sale.activitySalePrice || 0;
                                  
                                  const validPrices = [];
                                  if (originalListPrice > 0) validPrices.push(originalListPrice);
                                  if (discountedPrice > 0) validPrices.push(discountedPrice);
                                  if (activityPrice > 0) validPrices.push(activityPrice);
                                  
                                  const basePrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
                                  return formatCurrency(basePrice);
                                })()}
                              </small>
                            </div>
                          )}
                          
                          {/* Ödeme Tipi Badge - Kapora dışında */}
                          {sale.saleType !== 'kapora' && (
                            <Badge bg={getPaymentTypeClass(sale.paymentType)} className="mt-1">
                              {sale.paymentType}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td>
                        <div>
                          {/* Prim Tutarı ve Durumu */}
                          {sale.hasModifications && sale.modificationHistory && sale.modificationHistory.length > 0 && (
                            (() => {
                              const lastModification = sale.modificationHistory[sale.modificationHistory.length - 1];
                              if (lastModification.primDifference && lastModification.primDifference !== 0) {
                                // Değişiklik var - detaylı gösterim
                                const oldPrimAmount = lastModification.oldPrimAmount || 0;
                                const newPrimAmount = oldPrimAmount + lastModification.primDifference;
                                
                                return (
                                  <>
                                    {/* Yeni Toplam Prim */}
                                    <div className="fw-bold text-success">
                                      {formatCurrency(newPrimAmount)}
                                    </div>
                                    <small className="text-muted">(Yeni Prim Tutarı)</small>
                                    
                                    {/* Ödenen Kısım */}
                                    <div className="mt-1">
                                      <small className="text-muted">
                                        Ödenen: {formatCurrency(oldPrimAmount)}
                                      </small>
                                      <Badge bg="success" size="sm" className="ms-1">
                                        ödendi
                                      </Badge>
                                    </div>
                                    
                                    {/* Bekleyen Kısım */}
                                    <div className="mt-1">
                                      {lastModification.primDifference > 0 ? (
                                        <small className="text-success">
                                          <strong>Ödenecek Ek Prim: +{formatCurrency(Math.abs(lastModification.primDifference))}</strong>
                                        </small>
                                      ) : (
                                        <small className="text-danger">
                                          <strong>Kesilecek Prim: -{formatCurrency(Math.abs(lastModification.primDifference))}</strong>
                                        </small>
                                      )}
                                      {isAdmin && (
                                        <Badge 
                                          bg="warning" 
                                          size="sm" 
                                          className="ms-1" 
                                          style={{ cursor: 'pointer' }}
                                          onClick={() => {
                                            setSelectedPrimTransaction({
                                              primDifference: lastModification.primDifference,
                                              primTransactionId: lastModification.primTransaction,
                                              customerName: sale.customerName,
                                              blockNo: sale.blockNo,
                                              apartmentNo: sale.apartmentNo,
                                              salespersonName: sale.salesperson?.name
                                            });
                                            setShowPrimStatusModal(true);
                                          }}
                                        >
                                          {lastModification.primDifference > 0 ? 'ödenmedi' : 'kesilmedi'} 🔘
                                        </Badge>
                                      )}
                                      {!isAdmin && (
                                        <Badge bg="warning" size="sm" className="ms-1">
                                          {lastModification.primDifference > 0 ? 'ödenmedi' : 'kesilmedi'}
                                        </Badge>
                                      )}
                                    </div>
                                  </>
                                );
                              }
                              return null;
                            })()
                          )}
                          
                          {/* Normal Prim Gösterimi (değişiklik yoksa) */}
                          {!(sale.hasModifications && sale.modificationHistory && sale.modificationHistory.length > 0 && 
                             sale.modificationHistory[sale.modificationHistory.length - 1].primDifference !== 0) && (
                            <>
                              <div className="fw-bold text-success">
                                {formatCurrency(sale.saleType === 'kapora' ? 0 : (sale.primAmount || 0))}
                              </div>
                              <Badge bg={getPrimStatusBadgeClass(sale.primStatus)}>
                                {sale.primStatus}
                              </Badge>
                            </>
                          )}
                        </div>
                      </td>
                      <td>
                        <Badge bg={getSaleStatusBadgeClass(sale.status)}>
                          {sale.status}
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <FiUser className="me-2 text-muted" size={16} />
                          <small>{sale.salesperson?.name}</small>
                        </div>
                      </td>
                      <td className="text-center">
                        {sale.notes ? (
                          <Button
                            variant="outline-info"
                            size="sm"
                            onClick={() => openNotesModal(sale)}
                            title="Notu görüntüle"
                          >
                            <FiFileText />
                          </Button>
                        ) : (
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => openNotesModal(sale)}
                            title="Not ekle"
                            style={{ opacity: 0.5 }}
                          >
                            <FiFileText />
                          </Button>
                        )}
                      </td>
                      <td>
                        <Dropdown align="end">
                          <Dropdown.Toggle 
                            variant="outline-secondary" 
                            size="sm"
                            id={`dropdown-${sale._id}`}
                          >
                            <FiMoreVertical />
                          </Dropdown.Toggle>

                          <Dropdown.Menu className="shadow-lg"
                            style={{ 
                              minWidth: '200px',
                              zIndex: 1050
                            }}
                          >
                            {/* Düzenle - Sadece kendi satışı veya admin */}
                            {(isAdmin || sale.salesperson?._id === user?._id) && (
                              <Dropdown.Item as={Link} to={`/sales/edit/${sale._id}`}>
                                <FiEdit className="me-2" />
                                Düzenle
                              </Dropdown.Item>
                            )}

                            {/* Değişiklik Yap - Sadece kendi satışı veya admin */}
                            {sale.status === 'aktif' && (isAdmin || sale.salesperson?._id === user?._id) && (
                              <Dropdown.Item 
                                onClick={() => openModifyModal(sale)}
                                className="text-warning"
                              >
                                <FiEdit3 className="me-2" />
                                Değişiklik Yap
                              </Dropdown.Item>
                            )}

                            {/* Değişiklik Geçmişi - Admin tüm değişiklikleri, kullanıcı sadece kendi değişikliklerini görebilir */}
                            {(sale.hasModifications || sale.isModified) && (isAdmin || sale.salesperson?._id === user?._id) && (
                              <Dropdown.Item
                                onClick={() => openHistoryModal(sale)}
                                className="text-info"
                              >
                                <FiClock className="me-2" />
                                Değişiklik Geçmişi
                              </Dropdown.Item>
                            )}

                            {/* İptal Et - Sadece aktif satışlar için */}
                            {sale.status === 'aktif' && (isAdmin || sale.salesperson?._id === user?._id) && (
                              <Dropdown.Item 
                                onClick={() => openCancelModal(sale)}
                                className="text-danger"
                              >
                                <FiX className="me-2" />
                                İptal Et
                              </Dropdown.Item>
                            )}

                            {/* Transfer Et - Sadece admin için */}
                            {isAdmin && sale.status === 'aktif' && (
                              <Dropdown.Item onClick={() => openTransferModal(sale)}>
                                <FiUser className="me-2" />
                                Transfer Et
                              </Dropdown.Item>
                            )}

                            {/* Satışa Dönüştür - Sadece kapora için */}
                            {sale.saleType === 'kapora' && sale.status === 'aktif' && (isAdmin || sale.salesperson?._id === user?._id) && (
                              <Dropdown.Item 
                                onClick={() => openConvertModal(sale)}
                                className="text-primary"
                              >
                                <FiRefreshCw className="me-2" />
                                Satışa Dönüştür
                              </Dropdown.Item>
                            )}

                            {/* Prim Durumu - Sadece admin için */}
                            {isAdmin && sale.status === 'aktif' && (
                              <>
                                <Dropdown.Divider />
                                <Dropdown.Header>Prim Durumu</Dropdown.Header>
                                <Dropdown.Item 
                                  onClick={() => handlePrimStatusChange(sale._id, 'ödendi')}
                                  disabled={sale.primStatus === 'ödendi'}
                                >
                                  <FiDollarSign className="me-2" />
                                  Prim Ödendi
                                </Dropdown.Item>
                                <Dropdown.Item 
                                  onClick={() => handlePrimStatusChange(sale._id, 'ödenmedi')}
                                  disabled={sale.primStatus === 'ödenmedi'}
                                >
                                  <FiDollarSign className="me-2" />
                                  Prim Ödenmedi
                                </Dropdown.Item>
                              </>
                            )}

                            {/* Sil - Sadece admin için */}
                            {isAdmin && (
                              <>
                                <Dropdown.Divider />
                                <Dropdown.Item 
                                  onClick={() => handleDeleteSale(sale)}
                                  className="text-danger"
                                >
                                  <FiTrash2 className="me-2" />
                                  Kalıcı Olarak Sil
                                </Dropdown.Item>
                              </>
                            )}
                          </Dropdown.Menu>
                        </Dropdown>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="d-flex justify-content-center p-3">
                  <Pagination>
                    <Pagination.First 
                      onClick={() => handlePageChange(1)}
                      disabled={pagination.currentPage === 1}
                    />
                    <Pagination.Prev 
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      disabled={pagination.currentPage === 1}
                    />
                    
                    {[...Array(pagination.totalPages)].map((_, index) => {
                      const page = index + 1;
                      if (
                        page === 1 ||
                        page === pagination.totalPages ||
                        (page >= pagination.currentPage - 2 && page <= pagination.currentPage + 2)
                      ) {
                        return (
                          <Pagination.Item
                            key={page}
                            active={page === pagination.currentPage}
                            onClick={() => handlePageChange(page)}
                          >
                            {page}
                          </Pagination.Item>
                        );
                      } else if (
                        page === pagination.currentPage - 3 ||
                        page === pagination.currentPage + 3
                      ) {
                        return <Pagination.Ellipsis key={page} />;
                      }
                      return null;
                    })}
                    
                    <Pagination.Next 
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      disabled={pagination.currentPage === pagination.totalPages}
                    />
                    <Pagination.Last 
                      onClick={() => handlePageChange(pagination.totalPages)}
                      disabled={pagination.currentPage === pagination.totalPages}
                    />
                  </Pagination>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {/* Cancel Modal */}
      <Modal show={showCancelModal} onHide={() => setShowCancelModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Satışı İptal Et</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            <strong>{selectedSale?.customerName}</strong> müşterisine ait 
            <strong> {selectedSale?.contractNo}</strong> sözleşme numaralı satışı iptal etmek istediğinizden emin misiniz?
          </p>
          {selectedSale?.primStatus === 'ödendi' && (
            <Alert variant="warning">
              <strong>Dikkat:</strong> Bu satışın primi ödenmiş durumda. 
              İptal edilirse, gelecek prim döneminde kesinti yapılacaktır.
            </Alert>
          )}
          
          <Form.Group className="mt-3">
            <Form.Label>İptal Nedeni *</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="İptal nedenini detaylı olarak açıklayın..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              maxLength={500}
            />
            <Form.Text className="text-muted">
              Bu bilgi satış notlarına kaydedilecektir. ({cancelReason.length}/500 karakter)
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCancelModal(false)}>
            Vazgeç
          </Button>
          <Button 
            variant="danger" 
            onClick={handleCancelSale}
            disabled={!cancelReason.trim()}
          >
            İptal Et
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Transfer Modal */}
      {showTransferModal && (
        <TransferModal
          show={showTransferModal}
          onHide={() => setShowTransferModal(false)}
          sale={selectedSale}
          onSuccess={() => {
            fetchSales();
            setShowTransferModal(false);
            setSelectedSale(null);
          }}
        />
      )}

      {/* Notes Modal */}
      {showNotesModal && (
        <NotesModal
          show={showNotesModal}
          onHide={() => setShowNotesModal(false)}
          sale={selectedSale}
          onSuccess={() => {
            fetchSales();
            setShowNotesModal(false);
            setSelectedSale(null);
          }}
        />
      )}

      {/* Convert to Sale Modal */}
      {showConvertModal && (
        <ConvertToSaleModal
          show={showConvertModal}
          onHide={() => setShowConvertModal(false)}
          sale={selectedSale}
          onSuccess={() => {
            fetchSales();
            setShowConvertModal(false);
            setSelectedSale(null);
          }}
        />
      )}

      {/* Modify Sale Modal */}
      {showModifyModal && (
        <ModifySaleModal
          show={showModifyModal}
          onHide={() => setShowModifyModal(false)}
          sale={selectedSale}
          onModified={() => {
            fetchSales();
            setShowModifyModal(false);
            setSelectedSale(null);
          }}
        />
      )}

      {/* Modification History Modal */}
      {showHistoryModal && (
        <ModificationHistoryModal
          show={showHistoryModal}
          onHide={() => setShowHistoryModal(false)}
          sale={selectedSale}
        />
      )}

      {/* Prim Transaction Status Modal */}
      {showPrimStatusModal && (
        <PrimTransactionStatusModal
          show={showPrimStatusModal}
          onHide={() => setShowPrimStatusModal(false)}
          transaction={selectedPrimTransaction}
          onStatusUpdate={(status) => {
            console.log('Prim status updated:', status);
            // Refresh sales list
            fetchSales();
          }}
        />
      )}
    </div>
  );
};

export default SalesList;
