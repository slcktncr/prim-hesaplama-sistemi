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
  Modal,
  Alert,
  Pagination
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiSearch, 
  FiRefreshCw, 
  FiRotateCcw,
  FiUser,
  FiCalendar
} from 'react-icons/fi';

import { salesAPI, primsAPI, usersAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { 
  formatCurrency, 
  formatDate, 
  formatDateTime,
  getSaleStatusBadgeClass, 
  getPrimStatusBadgeClass,
  getPaymentTypeClass,
  debounce 
} from '../../utils/helpers';
import Loading from '../Common/Loading';

const CancelledSales = () => {
  const [sales, setSales] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    period: '',
    page: 1,
    limit: 10,
    status: 'iptal',
    salesperson: '' // temsilci filtresi
  });
  const [pagination, setPagination] = useState({
    totalPages: 1,
    currentPage: 1,
    total: 0
  });

  // Modal states
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);

  const { user } = useAuth();
  const isAdmin = user?.role && user.role.name === 'admin';

  useEffect(() => {
    fetchPeriods();
    fetchUsers(); // Tüm kullanıcılar temsilci listesini görebilir
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
      console.error('Cancelled sales fetch error:', error);
      setError('İptal edilen satışlar yüklenirken hata oluştu');
      toast.error('İptal edilen satışlar yüklenirken hata oluştu');
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

  const handleRestoreSale = async () => {
    if (!selectedSale) return;

    try {
      await salesAPI.restoreSale(selectedSale._id);
      toast.success('Satış başarıyla geri alındı');
      fetchSales();
      setShowRestoreModal(false);
      setSelectedSale(null);
    } catch (error) {
      console.error('Restore sale error:', error);
      toast.error(error.response?.data?.message || 'Satış geri alınırken hata oluştu');
    }
  };

  const openRestoreModal = (sale) => {
    setSelectedSale(sale);
    setShowRestoreModal(true);
  };

  if (loading && sales.length === 0) {
    return <Loading text="İptal edilen satışlar yükleniyor..." />;
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>İptal Edilen Satışlar</h1>
          <p className="text-muted mb-0">
            Toplam {pagination.total} iptal edilen satış
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <Card.Body>
          <Row>
            <Col md={4}>
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
            <Col md={3}>
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
            <Col md={3}>
              <Form.Group>
                <Form.Label>
                  <FiUser className="me-1" />
                  Temsilci
                </Form.Label>
                <Form.Select
                  value={filters.salesperson}
                  onChange={(e) => handleFilterChange('salesperson', e.target.value)}
                >
                  <option value="">Tüm Temsilciler</option>
                  {users.map(user => (
                    <option key={user._id} value={user.name}>
                      {user.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>&nbsp;</Form.Label>
                <div>
                  <Button variant="outline-secondary" onClick={fetchSales} disabled={loading}>
                    <FiRefreshCw className={loading ? 'spin' : ''} />
                  </Button>
                </div>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Cancelled Sales Table */}
      <Card>
        <Card.Body className="p-0">
          {sales.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-muted">İptal edilen satış bulunamadı.</p>
            </div>
          ) : (
            <>
              <Table responsive hover className="mb-0">
                <thead>
                  <tr>
                    <th>Müşteri</th>
                    <th>Konum</th>
                    <th>Sözleşme No</th>
                    <th>Satış Tarihi</th>
                    <th>Fiyatlar</th>
                    <th>Prim</th>
                    <th>İptal Bilgileri</th>
                    <th>Temsilci</th>
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
                        {formatDate(sale.saleDate)}
                      </td>
                      <td>
                        <div>
                          <div>Liste: {formatCurrency(sale.listPrice)}</div>
                          <div>Aktivite: {formatCurrency(sale.activitySalePrice)}</div>
                          <Badge bg={getPaymentTypeClass(sale.paymentType)} className="mt-1">
                            {sale.paymentType}
                          </Badge>
                        </div>
                      </td>
                      <td>
                        <div>
                          <div className="fw-bold text-danger">
                            {formatCurrency((() => {
                              // Kapora ise prim yok
                              if (sale.saleType === 'kapora') return 0;
                              
                              // Gerçek zamanlı prim hesaplama
                              const originalListPrice = sale.originalListPrice || sale.listPrice || 0;
                              const discountedPrice = sale.discountedListPrice || (sale.discountRate > 0 ? originalListPrice * (1 - sale.discountRate / 100) : 0);
                              const activityPrice = sale.activitySalePrice || 0;
                              const primRate = sale.primRate || 1; // Default %1
                              
                              const validPrices = [];
                              if (originalListPrice > 0) validPrices.push(originalListPrice);
                              if (discountedPrice > 0) validPrices.push(discountedPrice);
                              if (activityPrice > 0) validPrices.push(activityPrice);
                              
                              const basePrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
                              return basePrice * (primRate / 100); // Doğru hesaplama
                            })())}
                          </div>
                          <Badge bg={getPrimStatusBadgeClass(sale.primStatus)}>
                            {sale.primStatus}
                          </Badge>
                        </div>
                      </td>
                      <td>
                        <div>
                          <Badge bg={getSaleStatusBadgeClass(sale.status)} className="mb-1">
                            İptal Edildi
                          </Badge>
                          <div className="small text-muted">
                            <FiCalendar className="me-1" size={12} />
                            {formatDateTime(sale.cancelledAt)}
                          </div>
                          {sale.cancelledBy && (
                            <div className="small text-muted">
                              <FiUser className="me-1" size={12} />
                              {sale.cancelledBy.name}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <FiUser className="me-2 text-muted" size={16} />
                          <small>{sale.salesperson?.name}</small>
                        </div>
                      </td>
                      <td>
                        {/* Geri Al - Sadece kendi satışı veya admin */}
                        {(isAdmin || sale.salesperson?._id === user?._id) && (
                          <Button
                            variant="outline-success"
                            size="sm"
                            onClick={() => openRestoreModal(sale)}
                            title="Satışı Geri Al"
                          >
                            <FiRotateCcw className="me-1" />
                            Geri Al
                          </Button>
                        )}
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

      {/* Restore Modal */}
      <Modal show={showRestoreModal} onHide={() => setShowRestoreModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Satışı Geri Al</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            <strong>{selectedSale?.customerName}</strong> müşterisine ait 
            <strong> {selectedSale?.contractNo}</strong> sözleşme numaralı satışı geri almak istediğinizden emin misiniz?
          </p>
          <Alert variant="info">
            <strong>Bilgi:</strong> Satış geri alındığında:
            <ul className="mb-0 mt-2">
              <li>Satış aktif duruma geçecek</li>
              <li>Yeni prim işlemi oluşturulacak</li>
              <li>Satış listesinde görünmeye başlayacak</li>
            </ul>
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRestoreModal(false)}>
            Vazgeç
          </Button>
          <Button variant="success" onClick={handleRestoreSale}>
            Geri Al
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CancelledSales;
