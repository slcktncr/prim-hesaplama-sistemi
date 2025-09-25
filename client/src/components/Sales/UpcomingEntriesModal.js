import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Button, 
  Table, 
  Badge, 
  Form, 
  Alert,
  Spinner,
  Card,
  Row,
  Col
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiCalendar, 
  FiUser, 
  FiPhone, 
  FiMapPin, 
  FiRefreshCw,
  FiClock,
  FiDownload
} from 'react-icons/fi';

import { salesAPI } from '../../utils/api';
import { formatCurrency } from '../../utils/helpers';

const UpcomingEntriesModal = ({ show, onHide }) => {
  const [upcomingData, setUpcomingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [daysAhead, setDaysAhead] = useState(7);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show) {
      fetchUpcomingEntries();
    }
  }, [show, daysAhead]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUpcomingEntries = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await salesAPI.getUpcomingEntries(daysAhead);
      
      if (response.data.success) {
        setUpcomingData(response.data.data);
        console.log('📅 Upcoming entries loaded:', response.data.data);
      } else {
        throw new Error(response.data.message || 'Veri yüklenemedi');
      }
      
    } catch (error) {
      console.error('Upcoming entries fetch error:', error);
      setError(error.response?.data?.message || 'Yaklaşan girişler yüklenirken hata oluştu');
      toast.error('Yaklaşan girişler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const getDateLabel = (dateStr) => {
    const today = new Date();
    const [day, month] = dateStr.split('/').map(Number);
    const entryDate = new Date(today.getFullYear(), month - 1, day);
    
    const diffTime = entryDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Bugün';
    if (diffDays === 1) return 'Yarın';
    if (diffDays === -1) return 'Dün';
    if (diffDays > 0) return `${diffDays} gün sonra`;
    if (diffDays < 0) return `${Math.abs(diffDays)} gün önce`;
    
    return dateStr;
  };

  const getDateVariant = (dateStr) => {
    const today = new Date();
    const [day, month] = dateStr.split('/').map(Number);
    const entryDate = new Date(today.getFullYear(), month - 1, day);
    
    const diffTime = entryDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'danger';   // Bugün - Kırmızı
    if (diffDays === 1) return 'warning';  // Yarın - Sarı
    if (diffDays <= 3) return 'info';      // 3 gün içinde - Mavi
    return 'secondary';                     // Daha uzak - Gri
  };

  const exportToExcel = () => {
    if (!upcomingData || upcomingData.totalCount === 0) {
      toast.warning('Export edilecek veri bulunamadı');
      return;
    }

    // Tüm satışları tek bir diziye topla
    const allSales = [];
    upcomingData.sortedDates.forEach(dateStr => {
      upcomingData.groupedByDate[dateStr].forEach(sale => {
        allSales.push({
          entryDate: dateStr,
          customerName: sale.customerName || '',
          phone: sale.customerPhone || '',
          blockNo: sale.blockNo || '',
          apartmentNo: sale.apartmentNo || '',
          listPrice: sale.listPrice || 0,
          activityPrice: sale.activitySalePrice || 0,
          salesperson: sale.salesperson?.name || '',
          contractNo: sale.contractNo || '',
          saleDate: sale.saleDate ? new Date(sale.saleDate).toLocaleDateString('tr-TR') : '',
          kaporaDate: sale.kaporaDate ? new Date(sale.kaporaDate).toLocaleDateString('tr-TR') : ''
        });
      });
    });

    // Profesyonel HTML tablosu oluştur
    const today = new Date().toLocaleDateString('tr-TR');
    const reportTitle = `Yaklaşan Girişler Raporu - ${daysAhead} Gün İçinde`;
    
    let htmlContent = `
      <html>
        <head>
          <meta charset="utf-8">
          <title>${reportTitle}</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 20px;
              background-color: #f8f9fa;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding: 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border-radius: 10px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .header p {
              margin: 10px 0 0 0;
              font-size: 14px;
              opacity: 0.9;
            }
            .summary {
              background: white;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              text-align: center;
            }
            .summary-item {
              display: inline-block;
              margin: 0 20px;
              padding: 10px 15px;
              background: #e3f2fd;
              border-radius: 6px;
              border-left: 4px solid #2196f3;
            }
            .summary-item strong {
              color: #1976d2;
              font-size: 18px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse;
              background: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            th { 
              background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
              color: white;
              padding: 15px 12px;
              text-align: left;
              font-weight: 600;
              font-size: 13px;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
            td { 
              padding: 12px;
              border-bottom: 1px solid #e0e0e0;
              font-size: 13px;
              vertical-align: middle;
            }
            tr:nth-child(even) { 
              background-color: #f8f9fa; 
            }
            tr:hover { 
              background-color: #e3f2fd; 
            }
            .date-cell {
              background: #fff3e0;
              border-left: 4px solid #ff9800;
              font-weight: 600;
              color: #e65100;
            }
            .customer-cell {
              font-weight: 600;
              color: #1976d2;
            }
            .phone-cell {
              color: #388e3c;
              font-family: monospace;
            }
            .location-cell {
              background: #f3e5f5;
              color: #7b1fa2;
              text-align: center;
              font-weight: 500;
            }
            .price-cell {
              text-align: right;
              font-weight: 600;
              color: #d32f2f;
            }
            .salesperson-cell {
              background: #e8f5e8;
              color: #2e7d32;
              font-weight: 500;
            }
            .contract-cell {
              font-family: monospace;
              color: #5d4037;
              text-align: center;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              color: #666;
              font-size: 12px;
              padding: 20px;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .urgent { 
              background: #ffebee !important; 
              border-left: 4px solid #f44336;
            }
            .soon { 
              background: #fff8e1 !important; 
              border-left: 4px solid #ff9800;
            }
            .normal { 
              background: #e8f5e8 !important; 
              border-left: 4px solid #4caf50;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🏢 ${reportTitle}</h1>
            <p>Rapor Tarihi: ${today} | Toplam Kayıt: ${allSales.length}</p>
          </div>
          
          <div class="summary">
            <div class="summary-item">
              <div><strong>${upcomingData.totalCount}</strong></div>
              <div>Toplam Müşteri</div>
            </div>
            <div class="summary-item">
              <div><strong>${upcomingData.sortedDates.length}</strong></div>
              <div>Farklı Gün</div>
            </div>
            <div class="summary-item">
              <div><strong>${formatCurrency(allSales.reduce((sum, sale) => sum + sale.listPrice, 0))}</strong></div>
              <div>Toplam Liste Fiyatı</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>📅 Giriş Tarihi</th>
                <th>👤 Müşteri Adı</th>
                <th>📞 Telefon</th>
                <th>📍 Blok</th>
                <th>🏠 Daire</th>
                <th>💰 Liste Fiyatı</th>
                <th>🎯 Aktivite Fiyatı</th>
                <th>👨‍💼 Temsilci</th>
                <th>📄 Sözleşme No</th>
                <th>📅 Satış Tarihi</th>
                <th>💳 Kapora Tarihi</th>
              </tr>
            </thead>
            <tbody>`;

    // Satırları ekle
    allSales.forEach((sale, index) => {
      const today = new Date();
      const [day, month] = sale.entryDate.split('/').map(Number);
      const entryDate = new Date(today.getFullYear(), month - 1, day);
      const diffDays = Math.ceil((entryDate - today) / (1000 * 60 * 60 * 24));
      
      let rowClass = 'normal';
      if (diffDays <= 0) rowClass = 'urgent';
      else if (diffDays <= 2) rowClass = 'soon';
      
      htmlContent += `
        <tr class="${rowClass}">
          <td class="date-cell">${sale.entryDate}</td>
          <td class="customer-cell">${sale.customerName}</td>
          <td class="phone-cell">${sale.phone}</td>
          <td class="location-cell">${sale.blockNo}</td>
          <td class="location-cell">${sale.apartmentNo}</td>
          <td class="price-cell">${formatCurrency(sale.listPrice)}</td>
          <td class="price-cell">${formatCurrency(sale.activityPrice)}</td>
          <td class="salesperson-cell">${sale.salesperson}</td>
          <td class="contract-cell">${sale.contractNo}</td>
          <td>${sale.saleDate}</td>
          <td>${sale.kaporaDate}</td>
        </tr>`;
    });

    htmlContent += `
            </tbody>
          </table>
          
          <div class="footer">
            <p><strong>MOLA CRM Sistemi</strong> - Yaklaşan Girişler Raporu</p>
            <p>Bu rapor ${today} tarihinde otomatik olarak oluşturulmuştur.</p>
            <p style="margin-top: 10px;">
              <span style="background: #ffebee; padding: 4px 8px; border-radius: 4px; margin-right: 10px;">🔴 Bugün/Geçmiş</span>
              <span style="background: #fff8e1; padding: 4px 8px; border-radius: 4px; margin-right: 10px;">🟡 2 Gün İçinde</span>
              <span style="background: #e8f5e8; padding: 4px 8px; border-radius: 4px;">🟢 Normal</span>
            </p>
          </div>
        </body>
      </html>`;

    // Excel dosyası olarak indir
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const filename = `yaklasan-girisler-${daysAhead}-gun-${today.replace(/\./g, '-')}.xls`;
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`${allSales.length} kayıt Excel raporu olarak indirildi`);
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <FiCalendar className="me-2" />
          Yaklaşan Girişler
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        {/* Filtreler */}
        <Row className="mb-3">
          <Col md={6}>
            <Form.Group>
              <Form.Label>Kaç gün ilerisi</Form.Label>
              <Form.Select 
                value={daysAhead} 
                onChange={(e) => setDaysAhead(parseInt(e.target.value))}
                disabled={loading}
              >
                <option value={3}>3 gün</option>
                <option value={7}>1 hafta</option>
                <option value={14}>2 hafta</option>
                <option value={30}>1 ay</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>&nbsp;</Form.Label>
              <div className="d-flex gap-2">
                <Button 
                  variant="outline-primary" 
                  onClick={fetchUpcomingEntries}
                  disabled={loading}
                >
                  <FiRefreshCw className={`me-2 ${loading ? 'spin' : ''}`} />
                  Yenile
                </Button>
                <Button 
                  variant="outline-success" 
                  onClick={exportToExcel}
                  disabled={loading || !upcomingData || upcomingData.totalCount === 0}
                  title="Profesyonel Excel raporu olarak indir"
                >
                  <FiDownload className="me-2" />
                  Excel Raporu
                </Button>
              </div>
            </Form.Group>
          </Col>
        </Row>

        {/* Loading */}
        {loading && (
          <div className="text-center py-4">
            <Spinner animation="border" variant="primary" />
            <div className="mt-2">Yaklaşan girişler yükleniyor...</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert variant="danger">
            <strong>Hata:</strong> {error}
          </Alert>
        )}

        {/* Results */}
        {!loading && !error && upcomingData && (
          <>
            {upcomingData.totalCount === 0 ? (
              <Alert variant="info">
                <FiClock className="me-2" />
                Önümüzdeki {daysAhead} gün içinde giriş yapacak müşteri bulunmamaktadır.
              </Alert>
            ) : (
              <>
                {/* Summary */}
                <Alert variant="success">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong>{upcomingData.totalCount} müşteri</strong> önümüzdeki {daysAhead} gün içinde giriş yapacak.
                    </div>
                    <div className="text-muted small">
                      <FiDownload className="me-1" />
                      Excel Raporu butonuna tıklayarak profesyonel rapor indirebilirsiniz
                    </div>
                  </div>
                </Alert>

                {/* Grouped by Date */}
                {upcomingData.sortedDates.map(dateStr => (
                  <Card key={dateStr} className="mb-3">
                    <Card.Header>
                      <h6 className="mb-0">
                        <Badge bg={getDateVariant(dateStr)} className="me-2">
                          {dateStr}
                        </Badge>
                        {getDateLabel(dateStr)}
                        <Badge bg="secondary" className="ms-2">
                          {upcomingData.groupedByDate[dateStr].length} müşteri
                        </Badge>
                      </h6>
                    </Card.Header>
                    <Card.Body>
                      <Table responsive size="sm">
                        <thead>
                          <tr>
                            <th>Müşteri</th>
                            <th>Telefon</th>
                            <th>Konum</th>
                            <th>Satış Türü</th>
                            <th>Tutar</th>
                            <th>Temsilci</th>
                          </tr>
                        </thead>
                        <tbody>
                          {upcomingData.groupedByDate[dateStr].map(sale => (
                            <tr key={sale._id}>
                              <td>
                                <div className="d-flex align-items-center">
                                  <FiUser className="me-2 text-muted" />
                                  <div>
                                    <strong>{sale.customerName}</strong>
                                    {sale.phone && (
                                      <div className="small text-primary fw-bold">
                                        📞 {sale.phone}
                                      </div>
                                    )}
                                    {sale.contractNo && (
                                      <div className="small text-muted">
                                        Sözleşme: {sale.contractNo}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td>
                                {sale.phone ? (
                                  <div className="d-flex align-items-center">
                                    <FiPhone className="me-2 text-muted" />
                                    <a href={`tel:${sale.phone}`} className="text-decoration-none">
                                      {sale.phone}
                                    </a>
                                  </div>
                                ) : (
                                  <span className="text-muted">-</span>
                                )}
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <FiMapPin className="me-2 text-muted" />
                                  <div className="small">
                                    Blok {sale.blockNo}<br />
                                    Daire {sale.apartmentNo}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <Badge bg="info">
                                  {sale.saleType === 'satis' ? 'Satış' : 
                                   sale.saleType === 'kapora' ? 'Kapora' :
                                   sale.saleType === 'manuel' ? 'Manuel' :
                                   sale.saleType}
                                </Badge>
                              </td>
                              <td>
                                {sale.listPrice ? (
                                  <div className="small">
                                    <div>{formatCurrency(sale.listPrice)}</div>
                                    {sale.activitySalePrice && (
                                      <div className="text-muted">
                                        Aktivite: {formatCurrency(sale.activitySalePrice)}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted">-</span>
                                )}
                              </td>
                              <td>
                                <div className="small">
                                  {sale.salesperson?.name || 'Bilinmiyor'}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                ))}
              </>
            )}
          </>
        )}
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Kapat
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default UpcomingEntriesModal;
