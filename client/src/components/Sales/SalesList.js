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
  FiFileText
} from 'react-icons/fi';

import { salesAPI, primsAPI } from '../../utils/api';
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
import Loading from '../Common/Loading';

const SalesList = () => {
  const [sales, setSales] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    period: '',
    page: 1,
    limit: 10,
    primStatus: '', // 'ödendi', 'ödenmedi', ''
    startDate: '',
    endDate: ''
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
  const [selectedSale, setSelectedSale] = useState(null);

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchPeriods();
  }, []);

  useEffect(() => {
    const debouncedFetch = debounce(fetchSales, 500);
    debouncedFetch();
  }, [filters]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const response = await salesAPI.getSales(filters);
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

  const handleCancelSale = async () => {
    if (!selectedSale) return;

    try {
      await salesAPI.cancelSale(selectedSale._id);
      toast.success('Satış başarıyla iptal edildi');
      fetchSales();
      setShowCancelModal(false);
      setSelectedSale(null);
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
    return <Loading text="Satışlar yükleniyor..." />;
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
                          endDate: ''
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
                    <th>Müşteri</th>
                    <th>Konum</th>
                    <th>Sözleşme No</th>
                    <th>Tür</th>
                    <th>Tarih</th>
                    <th>Fiyatlar</th>
                    <th>Prim</th>
                    <th>Durum</th>
                    <th>Temsilci</th>
                    <th>Notlar</th>
                    <th>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale._id}>
                      <td>
                        <div>
                          <strong>{sale.customerName}</strong>
                          <br />
                          <small className="text-muted">
                            Dönem: {sale.periodNo}
                          </small>
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
                          bg={sale.saleType === 'kapora' ? 'warning' : 'success'} 
                          className="mb-1"
                        >
                          {sale.saleType === 'kapora' ? 'Kapora' : 'Satış'}
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
                        {sale.saleType === 'kapora' ? (
                          <div className="text-muted">
                            <small>Kapora - Fiyat Bilgisi Yok</small>
                          </div>
                        ) : (
                          <div>
                            {/* İndirim Öncesi Orijinal Liste Fiyatı */}
                            <div>
                              <strong>Liste: {formatCurrency(sale.originalListPrice || sale.listPrice)}</strong>
                            </div>
                            
                            {/* İndirim Varsa Göster */}
                            {sale.discountRate > 0 && (
                              <div>
                                <small className="text-success">
                                  İndirimli: {formatCurrency(sale.discountedListPrice || (sale.listPrice * (1 - sale.discountRate / 100)))}
                                </small>
                                <Badge bg="success" className="ms-1" style={{ fontSize: '0.6rem' }}>
                                  %{sale.discountRate} İndirim
                                </Badge>
                              </div>
                            )}
                            
                            {/* Aktivite Fiyatı */}
                            <div>
                              <small>Aktivite: {formatCurrency(sale.activitySalePrice)}</small>
                            </div>
                            
                            {/* Prim Hesaplama Tabanı */}
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
                            
                            <Badge bg={getPaymentTypeClass(sale.paymentType)} className="mt-1">
                              {sale.paymentType}
                            </Badge>
                          </div>
                        )}
                      </td>
                      <td>
                        <div>
                          <div className="fw-bold text-success">
                            {formatCurrency(sale.primAmount)}
                          </div>
                          <Badge bg={getPrimStatusBadgeClass(sale.primStatus)}>
                            {sale.primStatus}
                          </Badge>
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
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCancelModal(false)}>
            Vazgeç
          </Button>
          <Button variant="danger" onClick={handleCancelSale}>
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
    </div>
  );
};

export default SalesList;
