import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Table,
  Badge,
  ProgressBar,
  Spinner,
  Alert
} from 'react-bootstrap';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiUsers,
  FiMessageCircle,
  FiDollarSign,
  FiCalendar,
  FiBarChart2,
  FiActivity
} from 'react-icons/fi';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { toast } from 'react-toastify';
import { reportsAPI, usersAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

// Chart.js bileşenlerini kaydet
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const SalesEfficiencyReport = () => {
  const { user } = useAuth();
  const isAdmin = user?.role && user.role.name === 'admin';

  // State
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [users, setUsers] = useState([]);

  // Filters
  const [period, setPeriod] = useState('monthly'); // weekly, monthly, yearly
  const [startDate, setStartDate] = useState(() => {
    // Son 30 gün
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedSalesperson, setSelectedSalesperson] = useState('all');

  // Fetch users
  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch report on mount and filter change
  useEffect(() => {
    if (startDate && endDate) {
      fetchReport();
    }
  }, [startDate, endDate, period, selectedSalesperson]);

  const fetchUsers = async () => {
    try {
      const response = await usersAPI.getUsersForFilters();
      setUsers(response.data || []);
    } catch (error) {
      console.error('Users fetch error:', error);
    }
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const response = await reportsAPI.getSalesEfficiency({
        startDate,
        endDate,
        salesperson: selectedSalesperson,
        period
      });

      if (response.data && response.data.success) {
        setReportData(response.data.data);
      } else {
        toast.error('Rapor verisi alınamadı');
      }
    } catch (error) {
      console.error('Report fetch error:', error);
      toast.error(error.response?.data?.message || 'Rapor yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Quick date range selectors
  const setQuickDateRange = (range) => {
    const end = new Date();
    const start = new Date();

    switch (range) {
      case 'week':
        start.setDate(start.getDate() - 7);
        setPeriod('weekly');
        break;
      case 'month':
        start.setDate(start.getDate() - 30);
        setPeriod('monthly');
        break;
      case '3months':
        start.setMonth(start.getMonth() - 3);
        setPeriod('monthly');
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        setPeriod('yearly');
        break;
      default:
        break;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // Efficiency badge color
  const getEfficiencyColor = (efficiency) => {
    if (efficiency >= 15) return 'success';
    if (efficiency >= 10) return 'info';
    if (efficiency >= 5) return 'warning';
    return 'danger';
  };

  // Trend chart data
  const getTrendChartData = () => {
    if (!reportData || !reportData.periodAnalysis) return null;

    return {
      labels: reportData.periodAnalysis.map(p => p.period),
      datasets: [
        {
          label: 'Verimlilik Oranı (%)',
          data: reportData.periodAnalysis.map(p => p.efficiency.toFixed(2)),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Satışlar',
          data: reportData.periodAnalysis.map(p => p.totalSales),
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          yAxisID: 'y1',
          tension: 0.4
        },
        {
          label: 'İletişimler',
          data: reportData.periodAnalysis.map(p => p.totalCommunications),
          borderColor: 'rgb(255, 159, 64)',
          backgroundColor: 'rgba(255, 159, 64, 0.2)',
          yAxisID: 'y1',
          tension: 0.4
        }
      ]
    };
  };

  const trendChartOptions = {
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top'
      },
      title: {
        display: true,
        text: 'Verimlilik Trend Analizi'
      }
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Verimlilik (%)'
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Sayı'
        },
        grid: {
          drawOnChartArea: false
        }
      }
    }
  };

  // Communication types chart
  const getCommunicationTypesChart = (user) => {
    const types = user.communicationsByType;
    const labels = Object.keys(types);
    const values = Object.values(types);

    return {
      labels: labels.map(label => {
        // Label mapping
        const mapping = {
          'whatsappIncoming': 'WhatsApp Gelen',
          'callIncoming': 'Arama Gelen',
          'callOutgoing': 'Arama Giden',
          'meetingNewCustomer': 'Yeni Müşteri',
          'meetingAfterSale': 'Satış Sonrası'
        };
        return mapping[label] || label;
      }),
      datasets: [{
        data: values,
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)'
        ],
        borderWidth: 1
      }]
    };
  };

  // Sales types chart
  const getSalesTypesChart = (user) => {
    const types = user.salesByType;
    const labels = Object.keys(types);
    const values = Object.values(types);

    return {
      labels: labels.map(label => {
        // Label mapping
        const mapping = {
          'satis': 'Normal Satış',
          'kapora': 'Kapora',
          'yazlik': 'Yazlık',
          'kislik': 'Kışlık'
        };
        return mapping[label] || label;
      }),
      datasets: [{
        label: 'Satış Sayısı',
        data: values,
        backgroundColor: [
          'rgba(75, 192, 192, 0.8)',
          'rgba(255, 159, 64, 0.8)',
          'rgba(153, 102, 255, 0.8)',
          'rgba(255, 205, 86, 0.8)'
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 205, 86, 1)'
        ],
        borderWidth: 1
      }]
    };
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 12,
          font: {
            size: 10
          }
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3 text-muted">Verimlilik analizi yükleniyor...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <Card className="shadow-sm mb-3">
        <Card.Body className="p-3">
          <Row className="g-2">
            <Col md={3}>
              <Form.Label className="small mb-1">Başlangıç Tarihi</Form.Label>
              <Form.Control
                type="date"
                size="sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Col>
            <Col md={3}>
              <Form.Label className="small mb-1">Bitiş Tarihi</Form.Label>
              <Form.Control
                type="date"
                size="sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Col>
            <Col md={3}>
              <Form.Label className="small mb-1">Dönem Tipi</Form.Label>
              <Form.Select
                size="sm"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="weekly">Haftalık</option>
                <option value="monthly">Aylık</option>
                <option value="yearly">Yıllık</option>
              </Form.Select>
            </Col>
            {isAdmin && (
              <Col md={3}>
                <Form.Label className="small mb-1">Temsilci</Form.Label>
                <Form.Select
                  size="sm"
                  value={selectedSalesperson}
                  onChange={(e) => setSelectedSalesperson(e.target.value)}
                >
                  <option value="all">Tüm Temsilciler</option>
                  {users.map(u => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </Form.Select>
              </Col>
            )}
          </Row>

          {/* Quick Date Buttons */}
          <div className="mt-2 d-flex gap-2 flex-wrap">
            <Button size="sm" variant="outline-secondary" onClick={() => setQuickDateRange('week')}>
              Son 7 Gün
            </Button>
            <Button size="sm" variant="outline-secondary" onClick={() => setQuickDateRange('month')}>
              Son 30 Gün
            </Button>
            <Button size="sm" variant="outline-secondary" onClick={() => setQuickDateRange('3months')}>
              Son 3 Ay
            </Button>
            <Button size="sm" variant="outline-secondary" onClick={() => setQuickDateRange('year')}>
              Son 1 Yıl
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* Overall Stats */}
      {reportData && reportData.overallStats && (
        <Row className="g-3 mb-3">
          <Col md={3}>
            <Card className="shadow-sm h-100 border-0" style={{ borderLeft: '4px solid #3498db' }}>
              <Card.Body className="p-3">
                <div className="d-flex align-items-center">
                  <div className="flex-shrink-0 me-3">
                    <div className="rounded-circle bg-primary bg-opacity-10 p-3">
                      <FiUsers size={24} className="text-primary" />
                    </div>
                  </div>
                  <div className="flex-grow-1">
                    <div className="small text-muted mb-1">Toplam Temsilci</div>
                    <div className="h4 mb-0 fw-bold">{reportData.overallStats.totalUsers}</div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={3}>
            <Card className="shadow-sm h-100 border-0" style={{ borderLeft: '4px solid #e74c3c' }}>
              <Card.Body className="p-3">
                <div className="d-flex align-items-center">
                  <div className="flex-shrink-0 me-3">
                    <div className="rounded-circle bg-danger bg-opacity-10 p-3">
                      <FiMessageCircle size={24} className="text-danger" />
                    </div>
                  </div>
                  <div className="flex-grow-1">
                    <div className="small text-muted mb-1">Toplam İletişim</div>
                    <div className="h4 mb-0 fw-bold">{reportData.overallStats.totalCommunications.toLocaleString()}</div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={3}>
            <Card className="shadow-sm h-100 border-0" style={{ borderLeft: '4px solid #27ae60' }}>
              <Card.Body className="p-3">
                <div className="d-flex align-items-center">
                  <div className="flex-shrink-0 me-3">
                    <div className="rounded-circle bg-success bg-opacity-10 p-3">
                      <FiDollarSign size={24} className="text-success" />
                    </div>
                  </div>
                  <div className="flex-grow-1">
                    <div className="small text-muted mb-1">Toplam Satış</div>
                    <div className="h4 mb-0 fw-bold">{reportData.overallStats.totalSales.toLocaleString()}</div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={3}>
            <Card className="shadow-sm h-100 border-0" style={{ borderLeft: '4px solid #f39c12' }}>
              <Card.Body className="p-3">
                <div className="d-flex align-items-center">
                  <div className="flex-shrink-0 me-3">
                    <div className="rounded-circle bg-warning bg-opacity-10 p-3">
                      <FiActivity size={24} className="text-warning" />
                    </div>
                  </div>
                  <div className="flex-grow-1">
                    <div className="small text-muted mb-1">Ortalama Verimlilik</div>
                    <div className="h4 mb-0 fw-bold">
                      %{reportData.overallStats.averageEfficiency.toFixed(2)}
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Trend Chart */}
      {reportData && reportData.periodAnalysis && reportData.periodAnalysis.length > 0 && (
        <Card className="shadow-sm mb-3">
          <Card.Header className="bg-white">
            <h6 className="mb-0">
              <FiBarChart2 className="me-2" />
              Verimlilik Trend Analizi
            </h6>
          </Card.Header>
          <Card.Body>
            <Line data={getTrendChartData()} options={trendChartOptions} />
          </Card.Body>
        </Card>
      )}

      {/* Top & Bottom Performers */}
      {reportData && reportData.overallStats && (
        <Row className="g-3 mb-3">
          {reportData.overallStats.topPerformer && (
            <Col md={6}>
              <Card className="shadow-sm border-success">
                <Card.Header className="bg-success text-white">
                  <FiTrendingUp className="me-2" />
                  En Verimli Temsilci
                </Card.Header>
                <Card.Body>
                  <h5 className="mb-2">{reportData.overallStats.topPerformer.userName}</h5>
                  <Row className="g-2">
                    <Col xs={6}>
                      <div className="small text-muted">İletişim</div>
                      <div className="fw-bold">{reportData.overallStats.topPerformer.totalCommunications}</div>
                    </Col>
                    <Col xs={6}>
                      <div className="small text-muted">Satış</div>
                      <div className="fw-bold">{reportData.overallStats.topPerformer.totalSales}</div>
                    </Col>
                    <Col xs={12}>
                      <div className="small text-muted mb-1">Verimlilik</div>
                      <ProgressBar
                        now={reportData.overallStats.topPerformer.averageEfficiency}
                        label={`${reportData.overallStats.topPerformer.averageEfficiency.toFixed(1)}%`}
                        variant="success"
                      />
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
          )}

          {reportData.overallStats.lowestPerformer && (
            <Col md={6}>
              <Card className="shadow-sm border-danger">
                <Card.Header className="bg-danger text-white">
                  <FiTrendingDown className="me-2" />
                  Gelişim Gereken Temsilci
                </Card.Header>
                <Card.Body>
                  <h5 className="mb-2">{reportData.overallStats.lowestPerformer.userName}</h5>
                  <Row className="g-2">
                    <Col xs={6}>
                      <div className="small text-muted">İletişim</div>
                      <div className="fw-bold">{reportData.overallStats.lowestPerformer.totalCommunications}</div>
                    </Col>
                    <Col xs={6}>
                      <div className="small text-muted">Satış</div>
                      <div className="fw-bold">{reportData.overallStats.lowestPerformer.totalSales}</div>
                    </Col>
                    <Col xs={12}>
                      <div className="small text-muted mb-1">Verimlilik</div>
                      <ProgressBar
                        now={reportData.overallStats.lowestPerformer.averageEfficiency}
                        label={`${reportData.overallStats.lowestPerformer.averageEfficiency.toFixed(1)}%`}
                        variant="danger"
                      />
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
          )}
        </Row>
      )}

      {/* User Performance Table */}
      {reportData && reportData.userPerformance && reportData.userPerformance.length > 0 ? (
        <Card className="shadow-sm mb-3">
          <Card.Header className="bg-white">
            <h6 className="mb-0">
              <FiUsers className="me-2" />
              Detaylı Temsilci Analizi
            </h6>
          </Card.Header>
          <Card.Body className="p-0">
            <div className="table-responsive">
              <Table hover className="mb-0">
                <thead className="bg-light">
                  <tr>
                    <th className="border-0">#</th>
                    <th className="border-0">Temsilci</th>
                    <th className="border-0 text-center">İletişim</th>
                    <th className="border-0 text-center">Satış</th>
                    <th className="border-0 text-center">Verimlilik</th>
                    <th className="border-0 text-center">İletişim Dağılımı</th>
                    <th className="border-0 text-center">Satış Dağılımı</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.userPerformance.map((perf, index) => (
                    <tr key={perf.userId}>
                      <td className="align-middle">
                        <Badge bg={index === 0 ? 'warning' : index === 1 ? 'secondary' : index === 2 ? 'info' : 'light'} text={index > 2 ? 'dark' : 'white'}>
                          {index + 1}
                        </Badge>
                      </td>
                      <td className="align-middle">
                        <div className="fw-bold">{perf.userName}</div>
                        <small className="text-muted">{perf.userEmail}</small>
                      </td>
                      <td className="align-middle text-center">
                        <Badge bg="danger" pill>{perf.totalCommunications}</Badge>
                      </td>
                      <td className="align-middle text-center">
                        <Badge bg="success" pill>{perf.totalSales}</Badge>
                      </td>
                      <td className="align-middle">
                        <div className="d-flex align-items-center justify-content-center gap-2">
                          <Badge bg={getEfficiencyColor(perf.averageEfficiency)}>
                            {perf.averageEfficiency.toFixed(2)}%
                          </Badge>
                          <div style={{ width: '100px' }}>
                            <ProgressBar
                              now={Math.min(perf.averageEfficiency, 100)}
                              variant={getEfficiencyColor(perf.averageEfficiency)}
                              style={{ height: '8px' }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="align-middle" style={{ width: '200px' }}>
                        {Object.keys(perf.communicationsByType).length > 0 && (
                          <div style={{ height: '150px' }}>
                            <Doughnut
                              data={getCommunicationTypesChart(perf)}
                              options={doughnutOptions}
                            />
                          </div>
                        )}
                      </td>
                      <td className="align-middle" style={{ width: '200px' }}>
                        {Object.keys(perf.salesByType).length > 0 && (
                          <div style={{ height: '150px' }}>
                            <Bar
                              data={getSalesTypesChart(perf)}
                              options={{
                                ...doughnutOptions,
                                indexAxis: 'y',
                                scales: {
                                  x: {
                                    beginAtZero: true,
                                    ticks: {
                                      stepSize: 1
                                    }
                                  }
                                }
                              }}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      ) : (
        <Alert variant="info" className="text-center">
          <FiCalendar size={48} className="mb-3 text-muted" />
          <p className="mb-0">Seçilen tarih aralığında veri bulunamadı.</p>
        </Alert>
      )}

      {/* Info Card */}
      <Alert variant="info" className="shadow-sm">
        <Alert.Heading className="h6">
          <FiActivity className="me-2" />
          Verimlilik Nasıl Hesaplanır?
        </Alert.Heading>
        <p className="mb-0 small">
          <strong>Verimlilik Oranı = (Toplam Satış / Toplam İletişim) × 100</strong><br />
          Bu oran, bir temsilcinin kurduğu iletişimlerin kaçının satışa dönüştüğünü gösterir.
          Yüksek oran, daha verimli çalışma anlamına gelir.
        </p>
        <hr className="my-2" />
        <div className="small">
          <Badge bg="success" className="me-2">%15+</Badge> Mükemmel
          <Badge bg="info" className="me-2 ms-3">%10-15</Badge> İyi
          <Badge bg="warning" className="me-2 ms-3">%5-10</Badge> Orta
          <Badge bg="danger" className="ms-3">%0-5</Badge> Geliştirilmeli
        </div>
      </Alert>
    </div>
  );
};

export default SalesEfficiencyReport;

