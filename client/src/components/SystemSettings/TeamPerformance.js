import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Form,
  Row,
  Col,
  Alert,
  Spinner,
  Table,
  Badge,
  ProgressBar,
  Tabs,
  Tab
} from 'react-bootstrap';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiAlertTriangle,
  FiCheckCircle,
  FiUsers,
  FiPhone,
  FiMessageSquare,
  FiDollarSign
} from 'react-icons/fi';
import api from '../../utils/api';

const TeamPerformance = () => {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [performanceData, setPerformanceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const response = await api.get('/teams');
      setTeams(response.data.data);
    } catch (err) {
      console.error('Takım listesi hatası:', err);
      setError('Takımlar yüklenirken hata oluştu');
    }
  };

  const fetchPerformance = async () => {
    if (!selectedTeam) {
      setError('Lütfen bir takım seçin');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(`/teams/${selectedTeam}/performance`, {
        params: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        }
      });

      setPerformanceData(response.data.data);
    } catch (err) {
      console.error('Performans analizi hatası:', err);
      setError(err.response?.data?.message || 'Performans analizi yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadgeVariant = (level) => {
    switch (level) {
      case 'Yüksek': return 'danger';
      case 'Orta': return 'warning';
      case 'Düşük': return 'success';
      default: return 'secondary';
    }
  };

  const getSuccessBadgeVariant = (level) => {
    switch (level) {
      case 'Yüksek': return 'success';
      case 'İyi': return 'info';
      case 'Orta': return 'warning';
      case 'Düşük': return 'danger';
      default: return 'secondary';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'info';
    if (score >= 40) return 'warning';
    return 'danger';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  };

  const formatPercentage = (value) => {
    return `%${(value * 100).toFixed(1)}`;
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h4>
          <FiTrendingUp className="me-2" />
          Takım Performans Analizi
        </h4>
        <p className="text-muted mb-0">
          Takımların performansını detaylı olarak analiz edin ve risk/başarı durumlarını görün
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <Card.Body>
          <Row className="align-items-end">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Takım Seçin</Form.Label>
                <Form.Select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                >
                  <option value="">Takım seçin...</option>
                  {teams.map(team => (
                    <option key={team._id} value={team._id}>
                      {team.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Başlangıç Tarihi</Form.Label>
                <Form.Control
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({
                    ...prev,
                    startDate: e.target.value
                  }))}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Bitiş Tarihi</Form.Label>
                <Form.Control
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({
                    ...prev,
                    endDate: e.target.value
                  }))}
                />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Button
                variant="primary"
                onClick={fetchPerformance}
                disabled={loading || !selectedTeam}
                className="w-100"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-2" />
                    Analiz Ediliyor...
                  </>
                ) : (
                  'Analiz Et'
                )}
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Performance Results */}
      {performanceData && (
        <>
          {/* Team Summary */}
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">
                <FiUsers className="me-2" />
                {performanceData.team.name} - Genel Özet
              </h5>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={3}>
                  <div className="text-center p-3 border rounded">
                    <FiPhone size={32} className="text-primary mb-2" />
                    <h4 className="mb-0">{performanceData.teamStats.totalPhoneCalls}</h4>
                    <small className="text-muted">Toplam Telefon Görüşmesi</small>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="text-center p-3 border rounded">
                    <FiMessageSquare size={32} className="text-info mb-2" />
                    <h4 className="mb-0">{performanceData.teamStats.totalMeetings}</h4>
                    <small className="text-muted">Toplam Birebir Görüşme</small>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="text-center p-3 border rounded">
                    <FiDollarSign size={32} className="text-success mb-2" />
                    <h4 className="mb-0">{performanceData.teamStats.totalSales}</h4>
                    <small className="text-muted">Toplam Satış</small>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="text-center p-3 border rounded">
                    <FiTrendingUp size={32} className="text-warning mb-2" />
                    <h4 className="mb-0">{performanceData.teamStats.averageOverallScore}</h4>
                    <small className="text-muted">Ortalama Performans Skoru</small>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Individual Performance */}
          <Card>
            <Card.Header>
              <h5 className="mb-0">Bireysel Performans Analizi</h5>
            </Card.Header>
            <Card.Body>
              <Tabs defaultActiveKey="overview" className="mb-3">
                <Tab eventKey="overview" title="Genel Bakış">
                  <div className="table-responsive">
                    <Table hover>
                      <thead>
                        <tr>
                          <th>Kullanıcı</th>
                          <th>Aktivite</th>
                          <th>Dönüşüm Oranları</th>
                          <th>Performans Skoru</th>
                          <th>Başarı</th>
                          <th>Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(performanceData.userPerformance).map(([userId, perf]) => {
                          const user = performanceData.team.teamLeader._id === userId 
                            ? performanceData.team.teamLeader 
                            : null;
                          
                          return (
                            <tr key={userId}>
                              <td>
                                {user ? (
                                  <>
                                    {user.name || `${user.firstName} ${user.lastName}`}
                                    {performanceData.team.teamLeader._id === userId && (
                                      <Badge bg="primary" className="ms-2">Lider</Badge>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-muted">Kullanıcı</span>
                                )}
                              </td>
                              <td>
                                <small>
                                  <div>📞 {perf.phoneCalls} arama</div>
                                  <div>👥 {perf.inPersonMeetings} görüşme</div>
                                  <div>💰 {perf.totalSales} satış</div>
                                </small>
                              </td>
                              <td>
                                <small>
                                  <div>
                                    Telefon→Görüşme: {formatPercentage(perf.metrics.conversionRates.phoneToMeeting)}
                                    <span className="text-muted">
                                      {' '}(Hedef: {formatPercentage(perf.metrics.conversionRates.phoneToMeetingTarget)})
                                    </span>
                                  </div>
                                  <div>
                                    Görüşme→Satış: {formatPercentage(perf.metrics.conversionRates.meetingToSales)}
                                    <span className="text-muted">
                                      {' '}(Hedef: {formatPercentage(perf.metrics.conversionRates.meetingToSalesTarget)})
                                    </span>
                                  </div>
                                </small>
                              </td>
                              <td>
                                <div className="mb-2">
                                  <ProgressBar
                                    now={perf.metrics.scores.overallScore}
                                    variant={getScoreColor(perf.metrics.scores.overallScore)}
                                    label={`${perf.metrics.scores.overallScore}%`}
                                  />
                                </div>
                              </td>
                              <td>
                                <Badge bg={getSuccessBadgeVariant(perf.metrics.success.level)}>
                                  {perf.metrics.success.level}
                                </Badge>
                              </td>
                              <td>
                                <Badge bg={getRiskBadgeVariant(perf.metrics.risk.level)}>
                                  {perf.metrics.risk.level}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                </Tab>

                <Tab eventKey="detailed" title="Detaylı Analiz">
                  {Object.entries(performanceData.userPerformance).map(([userId, perf]) => {
                    const user = performanceData.team.teamLeader._id === userId 
                      ? performanceData.team.teamLeader 
                      : null;

                    return (
                      <Card key={userId} className="mb-3">
                        <Card.Header className="d-flex justify-content-between align-items-center">
                          <h6 className="mb-0">
                            {user ? (user.name || `${user.firstName} ${user.lastName}`) : 'Kullanıcı'}
                            {performanceData.team.teamLeader._id === userId && (
                              <Badge bg="primary" className="ms-2">Takım Lideri</Badge>
                            )}
                          </h6>
                          <Badge bg={getScoreColor(perf.metrics.scores.overallScore)} className="fs-6">
                            Genel Skor: {perf.metrics.scores.overallScore}%
                          </Badge>
                        </Card.Header>
                        <Card.Body>
                          <Row>
                            <Col md={6}>
                              <h6 className="mb-3">Performans Skorları</h6>
                              <div className="mb-2">
                                <small className="text-muted">Telefon Görüşme Skoru</small>
                                <ProgressBar
                                  now={perf.metrics.scores.phoneCallScore}
                                  variant={getScoreColor(perf.metrics.scores.phoneCallScore)}
                                  label={`${perf.metrics.scores.phoneCallScore}%`}
                                />
                              </div>
                              <div className="mb-2">
                                <small className="text-muted">Birebir Görüşme Skoru</small>
                                <ProgressBar
                                  now={perf.metrics.scores.meetingScore}
                                  variant={getScoreColor(perf.metrics.scores.meetingScore)}
                                  label={`${perf.metrics.scores.meetingScore}%`}
                                />
                              </div>
                              <div className="mb-2">
                                <small className="text-muted">Satış Skoru</small>
                                <ProgressBar
                                  now={perf.metrics.scores.salesScore}
                                  variant={getScoreColor(perf.metrics.scores.salesScore)}
                                  label={`${perf.metrics.scores.salesScore}%`}
                                />
                              </div>
                              <div className="mb-2">
                                <small className="text-muted">Telefon→Görüşme Dönüşüm Skoru</small>
                                <ProgressBar
                                  now={perf.metrics.scores.phoneToMeetingScore}
                                  variant={getScoreColor(perf.metrics.scores.phoneToMeetingScore)}
                                  label={`${perf.metrics.scores.phoneToMeetingScore}%`}
                                />
                              </div>
                              <div className="mb-2">
                                <small className="text-muted">Görüşme→Satış Dönüşüm Skoru</small>
                                <ProgressBar
                                  now={perf.metrics.scores.meetingToSalesScore}
                                  variant={getScoreColor(perf.metrics.scores.meetingToSalesScore)}
                                  label={`${perf.metrics.scores.meetingToSalesScore}%`}
                                />
                              </div>
                            </Col>
                            <Col md={6}>
                              <Row>
                                <Col md={6}>
                                  <h6 className="mb-3">
                                    <FiCheckCircle className="me-2 text-success" />
                                    Başarı Faktörleri
                                  </h6>
                                  <Badge bg={getSuccessBadgeVariant(perf.metrics.success.level)} className="mb-2">
                                    {perf.metrics.success.level}
                                  </Badge>
                                  {perf.metrics.success.factors.length > 0 ? (
                                    <ul className="small">
                                      {perf.metrics.success.factors.map((factor, idx) => (
                                        <li key={idx} className="text-success">{factor}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-muted small">Başarı faktörü bulunamadı</p>
                                  )}
                                </Col>
                                <Col md={6}>
                                  <h6 className="mb-3">
                                    <FiAlertTriangle className="me-2 text-warning" />
                                    Risk Faktörleri
                                  </h6>
                                  <Badge bg={getRiskBadgeVariant(perf.metrics.risk.level)} className="mb-2">
                                    {perf.metrics.risk.level}
                                  </Badge>
                                  {perf.metrics.risk.factors.length > 0 ? (
                                    <ul className="small">
                                      {perf.metrics.risk.factors.map((factor, idx) => (
                                        <li key={idx} className="text-danger">{factor}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-muted small">Risk faktörü bulunamadı</p>
                                  )}
                                </Col>
                              </Row>
                            </Col>
                          </Row>
                        </Card.Body>
                      </Card>
                    );
                  })}
                </Tab>
              </Tabs>
            </Card.Body>
          </Card>
        </>
      )}

      {/* Empty State */}
      {!performanceData && !loading && !error && (
        <Card>
          <Card.Body className="text-center py-5">
            <FiTrendingUp size={48} className="text-muted mb-3" />
            <h5 className="text-muted">Performans Analizi</h5>
            <p className="text-muted">
              Bir takım ve tarih aralığı seçerek detaylı performans analizi yapın
            </p>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default TeamPerformance;

