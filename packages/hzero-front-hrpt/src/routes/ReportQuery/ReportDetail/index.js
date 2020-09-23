/**
 * Detail - 报表平台/报表查询-详情
 * @date: 2018-11-28
 * @author: LZY <zhuyan.luo@hand-china.com>
 * @version: 1.0.0
 * @copyright Copyright (c) 2018, Hand
 */

import React, { Component } from 'react';
import { Button, Col, Form, Icon, Pagination, Row, Spin, Switch, Tooltip, Select } from 'hzero-ui';
import { connect } from 'dva';
import { filter, forEach, isArray, isEmpty, isObject, isUndefined, join, map, forIn } from 'lodash';
import { Bind } from 'lodash-decorators';
import moment from 'moment';
import qs from 'query-string';
import uuid from 'uuid/v4';

import { Header } from 'components/Page';
import Icons from 'components/Icons';
import Lov from 'components/Lov';

import formatterCollections from 'utils/intl/formatterCollections';
import intl from 'utils/intl';
import {
  filterNullValueObject,
  getCurrentOrganizationId,
  getDateFormat,
  getDateTimeFormat,
  getAccessToken,
  isTenantRoleLevel,
} from 'utils/utils';
import { HZERO_RPT, API_HOST } from 'utils/config';
// import request from 'utils/request';
import notification from 'utils/notification';
import { DEFAULT_DATETIME_FORMAT } from 'utils/constants';
import { downloadFile } from 'services/api';
import ReportView from '@/components/ReportView';
import ParamsForm from './ParamsForm';
import Drawer from './Drawer';

import styles from './index.less';

const currentTenantId = getCurrentOrganizationId();

/**
 * 审批规则头-行数据管理组件
 * @extends {Component} - React.Component
 * @reactProps {Object} [location={}] - 当前路由信息
 * @reactProps {Object} [match={}] - react-router match路由信息
 * @reactProps {!Object} reportQuery - 数据源
 * @reactProps {!Object} fetchApproveHeaderLoading - 数据加载是否完成
 * @reactProps {!Object} saving - 保存是否完成
 * @reactProps {Object} form - 表单对象
 * @reactProps {Function} [dispatch=function(e) {return e;}] - redux dispatch方法
 * @return React.element
 */
@connect(({ reportQuery, loading }) => ({
  reportQuery,
  fetchParamsLoading: loading.effects['reportQuery/fetchParams'],
  buildReportLoading: loading.effects['reportQuery/buildReport'],
  createRequestLoading: loading.effects['reportQuery/createRequest'],
  dateFormat: getDateFormat(),
  dateTimeFormat: getDateTimeFormat(),
}))
@Form.create({ fieldNameProp: null })
@formatterCollections({ code: ['hrpt.reportQuery', 'hrpt.reportQuery'] })
export default class Detail extends Component {
  form;

  /**
   * state初始化
   */
  state = {
    // exportLoading: false,
    reportData: {},
    currentPage: 1,
    drawerVisible: false,
    EChartsVisible: false,
    chartType: 'bar', // 图表类型
    uuidKey: '',
    chartParams: {},
  };

  /**
   * render()调用后获取数据
   */
  componentDidMount() {
    const {
      location: { search },
    } = this.props;
    const { chartType: type } = qs.parse(search);
    const { chartType } = this.state;
    this.setState({
      chartType: type || chartType,
    });
    this.handleSearch();
  }

  @Bind()
  handleSearch() {
    const { dispatch, match, location } = this.props;
    const { search = {} } = location;
    const { id = '', code = '' } = match.params;
    const searchParams = qs.parse(search) || {};
    const { chartType, auto = '' } = searchParams;
    const reportDataId = id || code;
    this.setState({
      reportDataId,
    });
    dispatch({
      type: 'reportQuery/fetchParams',
      payload: {
        reportUuid: id || code,
      },
    }).then((res) => {
      // 如果是菜单跳转而来的
      // 如果chartType有值，证明从卡片跳转来
      if (res.reportTypeCode === 'C') {
        dispatch({ type: 'reportQuery/fetchChartType' });
      }
      if (res && (auto === 'true' || chartType)) {
        this.handleBuildReport();
      }
    });
  }

  // 生成报表
  @Bind()
  buildReport(pageParams = {}) {
    const { reportDataId } = this.state;
    const {
      form,
      dispatch,
      dateFormat,
      dateTimeFormat,
      reportQuery: { detail = {} },
    } = this.props;
    const { paramsData = {} } = detail[reportDataId] || {};
    const { reportUuid, formElements, reportTypeCode } = paramsData;
    this.form.validateFields((err1) => {
      if (!err1) {
        const fieldValues = isUndefined(this.form)
          ? {}
          : filterNullValueObject(this.form.getFieldsValue());

        form.validateFields((err, values) => {
          const { fCodeTenant, ...othersData } = values;
          const valueData = { ...othersData, 'f-templateCode': fCodeTenant };
          const newValues = filter(valueData, (item) => !isUndefined(item));
          let strParam = '';
          map(fieldValues, (value, key) => {
            if (isArray(value) && value.length > 0) {
              const separator = `&${key}=`;
              if (strParam) {
                strParam = `${separator}${join(value, separator)}&${strParam}`;
              } else {
                strParam = `${separator}${join(value, separator)}`;
              }
              if (isEmpty(newValues)) {
                strParam = strParam.substring(1);
              }
              // eslint-disable-next-line no-param-reassign
              delete fieldValues[key];
            } else if (isArray(value) && value.length === 0) {
              // eslint-disable-next-line no-param-reassign
              delete fieldValues[key];
            }
          });
          const formatFieldValues = { ...fieldValues };
          for (const key of Object.keys(fieldValues)) {
            if (isObject(fieldValues[key]) && moment(fieldValues[key]).isValid()) {
              // TODO: 处理日期时间的格式化
              formElements.forEach((n) => {
                if (n.name === key) {
                  if (n.type === 'DatePicker') {
                    formatFieldValues[key] = moment(fieldValues[key]).format(dateFormat);
                  } else if (n.type === 'DatetimePicker') {
                    formatFieldValues[key] = moment(fieldValues[key]).format(dateTimeFormat);
                  }
                }
              });
            }
          }
          if (!err) {
            if (reportTypeCode !== 'C') {
              dispatch({
                type: 'reportQuery/buildReport',
                payload: {
                  // type: reportTypeCode,
                  strParam,
                  reportUuid,
                  ...formatFieldValues,
                  ...values,
                  ...pageParams,
                },
              }).then((res) => {
                if (res) {
                  this.setState({ reportData: res }, () => {
                    if (reportTypeCode === 'ST') {
                      this.handleScrollDom();
                    }
                  });
                }
              });
            } else if (reportTypeCode === 'C') {
              const params = { strParam, ...formatFieldValues, ...values, ...pageParams };
              this.setState({
                EChartsVisible: true,
                uuidKey: uuid(),
                chartParams: params,
              });
            }
          }
        });
      }
    });
  }

  // 定时报表
  @Bind()
  handleCreateRequest(fieldsValue = {}) {
    const { reportDataId } = this.state;
    const {
      form,
      dispatch,
      reportQuery: { detail = {} },
    } = this.props;
    const { paramsData = {} } = detail[reportDataId] || {};
    const { reportUuid } = paramsData;
    const { startDate, endDate, ...others } = fieldsValue;
    this.form.validateFields((err1) => {
      if (!err1) {
        const fieldValues = isUndefined(this.form)
          ? {}
          : filterNullValueObject(this.form.getFieldsValue());

        form.validateFields((err, values) => {
          const { fCodeTenant, ...othersData } = values;
          const valueData = { ...othersData, 'f-templateCode': fCodeTenant };
          const newValues = filter(valueData, (item) => !isUndefined(item));
          let strParam;
          map(fieldValues, (value, key) => {
            if (isArray(value) && value.length > 0) {
              const separator = `&${key}=`;
              if (strParam) {
                strParam = `${separator}${join(value, separator)}&${strParam}`;
              } else {
                strParam = `${separator}${join(value, separator)}`;
              }
              if (isEmpty(newValues)) {
                strParam = strParam.substring(1);
              }
              // eslint-disable-next-line no-param-reassign
              delete fieldValues[key];
            } else if (isArray(value) && value.length === 0) {
              // eslint-disable-next-line no-param-reassign
              delete fieldValues[key];
            }
          });
          if (!err) {
            dispatch({
              type: 'reportQuery/createRequest',
              payload: {
                strParam,
                reportUuid,
                ...fieldValues,
                ...valueData,
                startDate: startDate ? moment(startDate).format(DEFAULT_DATETIME_FORMAT) : null,
                endDate: endDate ? moment(endDate).format(DEFAULT_DATETIME_FORMAT) : null,
                tenantId: currentTenantId,
                ...others,
              },
            }).then((res) => {
              if (res) {
                notification.success();
                this.handleCloseDrawer();
              }
            });
          }
        });
      }
    });
  }

  @Bind()
  handleBuildReport() {
    this.buildReport();
    this.setState({
      currentPage: 1,
    });
  }

  @Bind()
  handleOpenDrawer() {
    this.setState({ drawerVisible: true });
  }

  @Bind()
  handleCloseDrawer() {
    this.setState({ drawerVisible: false });
  }

  @Bind()
  handleScrollDom() {
    const [tableHeader, tableBody] = document.getElementsByClassName('hreport');
    const tableDom = document.getElementsByClassName('hreport-table-body')[0];
    const tableHeaderDom = document.getElementsByClassName('hreport-table-head')[0];
    if (tableDom && tableHeaderDom) {
      if (tableDom.scrollHeight > (tableDom.offsetHeight || tableDom.clientHeight)) {
        tableHeaderDom.setAttribute('style', 'width:calc(100% - 15px)');
      }
    }
    if (tableDom && tableHeader && tableBody) {
      tableDom.addEventListener('scroll', () => {
        const { scrollLeft } = tableDom;
        const obj = {};
        const str = tableHeader.getAttribute('style');

        str.split(';').forEach((item) => {
          if (item) {
            const arr = item.split(': ') || [];
            const [name, value] = arr;
            obj[name] = value;
          }
        });
        obj['margin-left'] = `-${scrollLeft}px`;
        let styleStr = '';
        forIn(obj, (value, key) => {
          styleStr = `${styleStr}${key}: ${value};`;
        });
        tableHeader.setAttribute('style', styleStr);
      });
    }
  }

  // 导出成excel
  @Bind()
  handleExport(outputType) {
    const { reportDataId } = this.state;
    const {
      form,
      dateFormat,
      dateTimeFormat,
      reportQuery: { detail = {} },
    } = this.props;
    const { paramsData = {} } = detail[reportDataId] || {};
    const { reportUuid, formElements } = paramsData;
    this.form.validateFields((err1) => {
      if (!err1) {
        const fieldValues = isUndefined(this.form)
          ? {}
          : filterNullValueObject(this.form.getFieldsValue());
        let newParams = [];
        let params = [];
        // 将是多选的参数分离出来，多个数组元素拆分成多个独立的对象
        map(fieldValues, (value1, key1) => {
          if (isArray(value1) && value1.length > 0) {
            newParams = map(value1, (value) => ({ key: key1, value }));
            const paramsList = newParams.map((item) => ({ name: item.key, value: item.value }));
            params = [...params, ...paramsList];
            // eslint-disable-next-line no-param-reassign
            delete fieldValues[key1];
          } else if (isArray(value1) && value1.length === 0) {
            // eslint-disable-next-line no-param-reassign
            delete fieldValues[key1];
          }
        });
        const othersParams = map(fieldValues, (value, key) => {
          let newValues = value;
          formElements.forEach((item) => {
            if (item.type === 'DatePicker') {
              if (item.name === key) {
                newValues = moment(value).format(dateFormat);
              }
            } else if (item.type === 'DatetimePicker') {
              if (item.name === key) {
                newValues = moment(value).format(dateTimeFormat);
              }
            }
          });
          return { key, value: newValues };
        });
        forEach(othersParams, (item) => {
          params.push({ name: item.key, value: item.value });
        });

        const requestUrl = `${HZERO_RPT}/v1/${
          isTenantRoleLevel() ? `${currentTenantId}/` : ''
        }reports/export/${reportUuid}/${outputType}`;

        form.validateFields((err, values) => {
          const { fCodeTenant, ...othersData } = values;
          const valueData = { ...othersData, 'f-templateCode': fCodeTenant };
          const baseParams = map(valueData, (value, key) => ({ key, value }));
          forEach(baseParams, (item) => {
            params.push({ name: item.key, value: item.value });
          });
          const newValues = filter(params, (item) => !isUndefined(item.value));
          if (!err) {
            // GET方法导出
            if (outputType !== 'PRINT') {
              downloadFile({
                requestUrl,
                queryParams: newValues,
              });
            } else {
              this.handlePrint(requestUrl, newValues);
            }
          }
        });
      }
    });
  }

  // 打印
  @Bind()
  handlePrint(url, values) {
    let paramsStr = '';
    let requestUrl = `${API_HOST}${url}?access_token=${getAccessToken()}`;
    values.forEach((item) => {
      paramsStr = `${paramsStr}&${item.name}=${item.value}`;
    });
    if (paramsStr) {
      requestUrl = `${requestUrl}&${paramsStr}`;
    }
    window.open(requestUrl);
  }

  /**
   * 设置Form
   * @param {object} ref - FilterForm组件引用
   */
  @Bind()
  handleBindRef(ref = {}) {
    this.form = (ref.props || {}).form;
  }

  @Bind()
  onShowSizeChange(current, pageSize) {
    this.buildReport({ 'f-page': current - 1, 'f-size': pageSize });
    this.setState({
      currentPage: current,
    });
  }

  /**
   * 改变图表类型
   * @param {string} value
   */
  @Bind()
  onChangeChart(value) {
    this.setState({
      chartType: value,
    });
  }

  /**
   * render
   * @returns React.element
   */
  render() {
    const {
      // exportLoading,
      reportDataId,
      reportData: { htmlTable = '', metaDataPageSize = 10, metaDataRowTotal = 0 },
      currentPage,
      drawerVisible,
      EChartsVisible,
      chartType,
      uuidKey,
      chartParams,
    } = this.state;
    const {
      form,
      location: { search = {} },
      fetchParamsLoading = false,
      buildReportLoading = false,
      createRequestLoading = false,
      reportQuery: { detail = {}, intervalTypeList = [], chartsTypeList = [] },
    } = this.props;
    const { paramsData = {} } = detail[reportDataId] || {};
    const {
      reportTypeCode,
      reportId,
      reportName,
      formElements,
      templateTypeCode,
      reportUuid,
      limitRows,
      pageFlag,
    } = paramsData;

    const paramsProps = {
      fetchParamsLoading,
      formElements,
      reportId,
      reportTypeCode,
      onRef: this.handleBindRef,
    };

    const drawerProps = {
      createRequestLoading,
      intervalTypeList,
      visible: drawerVisible,
      onOk: this.handleCreateRequest,
      onCancel: this.handleCloseDrawer,
    };

    const reportViewProps = {
      rotate: 40,
      radius: 55,
      showReport: true,
      type: chartType,
      code: reportUuid,
      option: {
        grid: { bottom: '115', right: '120', left: '120' },
      },
      chartParams,
    };

    const searchParams = qs.parse(search) || {};

    return (
      <>
        <Header
          title={intl
            .get('hrpt.reportQuery.view.message.title.detail', {
              name: reportName,
            })
            .d(`${reportName} - 详情`)}
          backPath={searchParams.auto ? '' : '/hrpt/report-query/list'}
        >
          {!(templateTypeCode === 'xls' && reportTypeCode === 'D') && (
            <Button
              icon="save"
              type="primary"
              onClick={this.handleBuildReport}
              loading={buildReportLoading}
            >
              {intl.get('hrpt.reportQuery.option.buildReport').d('运行报表')}
            </Button>
          )}
          {(reportTypeCode === 'T' || reportTypeCode === 'ST') && (
            <Button icon="clock-circle" onClick={this.handleOpenDrawer}>
              {intl.get('hrpt.reportQuery.option.createRequest').d('定时报表')}
            </Button>
          )}

          {reportTypeCode === 'C' && (
            <div className={styles['chart-select']}>
              {intl.get('hrpt.reportQuery.view.reportQuery.selectTitle').d('选择图表类型：')}
              <Select
                defaultValue={chartType}
                className={styles['select-item']}
                onChange={(value) => {
                  this.onChangeChart(value);
                }}
              >
                {chartsTypeList.map((n) => (
                  <Select.Option key={n.value} value={n.value}>
                    {n.meaning}
                  </Select.Option>
                ))}
              </Select>
            </div>
          )}
          {['html', 'rtf', 'doc'].includes(templateTypeCode) && (
            <Tooltip title={intl.get('hrpt.reportQuery.option.print').d('打印')}>
              <Icons
                type="dayin"
                size={24}
                style={{ color: '#0303ab', cursor: 'pointer', margin: '0 8px' }}
                onClick={() => {
                  this.handleExport('PRINT');
                }}
              />
            </Tooltip>
          )}
          {reportTypeCode !== 'C' && (
            <Tooltip
              className={styles['icon-excel']}
              title={intl.get('hrpt.reportQuery.option.exportExcel').d('导出Excel')}
            >
              {['T', 'ST'].includes(reportTypeCode) ||
              ['html', 'xls'].includes(templateTypeCode) ? (
                <Icon onClick={() => this.handleExport('XLS')} />
              ) : (
                <Icon onClick={() => this.handleExport('XLSX')} />
              )}
            </Tooltip>
          )}

          {(templateTypeCode === 'rtf' || templateTypeCode === 'doc') && ( // 只有rtf和doc类型模板报表能导出PPT和Word
            <>
              <Tooltip
                className={styles['icon-ppt']}
                title={intl.get('hrpt.reportQuery.option.exportPPT').d('导出PPT')}
              >
                <Icon onClick={() => this.handleExport('PPTX')} />
              </Tooltip>
              <Tooltip
                className={styles['icon-word']}
                title={intl.get('hrpt.reportQuery.option.exportWord').d('导出Word')}
              >
                <Icon onClick={() => this.handleExport('DOCX')} />
              </Tooltip>
            </>
          )}

          {['html', 'rtf', 'doc'].includes(templateTypeCode) && ( // 只有pdf类型模板报表不能导出Excel
            <>
              <Tooltip
                className={styles['icon-pdf']}
                title={intl.get('hrpt.reportQuery.option.exportPdf').d('导出Pdf')}
              >
                <Icon onClick={() => this.handleExport('PDF')} />
              </Tooltip>
              <Tooltip
                key="notTable"
                className={styles['icon-html']}
                title={intl.get('hrpt.reportQuery.option.exportHTML').d('导出HTML')}
              >
                <Icon onClick={() => this.handleExport('HTML')} />
              </Tooltip>
            </>
          )}
          {(reportTypeCode === 'T' || reportTypeCode === 'ST') && ( // 表格报表可导出HTML
            <Tooltip
              key="isTable"
              className={styles['icon-html']}
              title={intl.get('hrpt.reportQuery.option.exportHTML').d('导出HTML')}
            >
              <Icon onClick={() => this.handleExport('HTML')} />
            </Tooltip>
          )}
          {reportTypeCode === 'ST' && (
            <Tooltip
              className={styles['icon-csv']}
              title={intl.get('hrpt.reportQuery.option.exportCSV').d('导出csv')}
            >
              <div style={{ marginTop: 6 }}>
                <Icons
                  type="csv"
                  size="34"
                  color="purple"
                  style={{ marginRight: 4, marginTop: 2 }}
                  onClick={() => this.handleExport('CSV')}
                />
              </div>
            </Tooltip>
          )}
        </Header>
        <div className={styles['content-sty']}>
          <div className={styles['report-content-form']}>
            <Form layout="inline">
              <Row>
                <Col span={8}>
                  {reportTypeCode === 'T' && (
                    <Form.Item
                      label={intl
                        .get('hrpt.reportQuery.model.reportQuery.isRowSpan')
                        .d('合并左边相同维度行')}
                    >
                      {form.getFieldDecorator('f-isRowSpan', {
                        initialValue: false,
                      })(<Switch />)}
                    </Form.Item>
                  )}
                  {reportTypeCode === 'D' && (
                    <Form.Item
                      label={intl.get('hrpt.reportQuery.model.reportQuery.template').d('模板')}
                    >
                      {form.getFieldDecorator(
                        'f-templateCode',
                        {}
                      )(
                        <Lov
                          code={
                            isTenantRoleLevel()
                              ? 'HRPT.REPORT_TEMPLATE.ORG'
                              : 'HRPT.REPORT_TEMPLATE'
                          }
                          queryParams={{
                            reportId,
                          }}
                          onChange={(text, record) => {
                            form.registerField('f-lang');
                            form.registerField('fCodeTenant');
                            form.setFieldsValue({ 'f-lang': record.lang });
                            form.setFieldsValue({ fCodeTenant: record.codeTenant });
                          }}
                        />
                      )}
                    </Form.Item>
                  )}
                </Col>
              </Row>
            </Form>
            <ParamsForm {...paramsProps} />
          </div>
          {htmlTable && (
            <div className={styles['model-title']}>
              {intl.get('hrpt.reportQuery.view.message.buildResult').d('生成结果')}
            </div>
          )}
          <div
            className={reportTypeCode === 'ST' ? styles['report-content-table'] : ''}
            style={{
              height: reportTypeCode === 'T' ? '450px' : '',
            }}
          >
            <div
              className={styles['auto-table']}
              style={{
                height: reportTypeCode === 'T' ? '450px' : '',
                overflow: reportTypeCode === 'ST' ? '' : 'auto',
              }}
            >
              <div
                className={styles['report-query']}
                dangerouslySetInnerHTML={{ __html: htmlTable }}
              />
            </div>
          </div>
          <div className={styles['report-content-pagination']}>
            {(reportTypeCode === 'T' || reportTypeCode === 'ST') &&
              pageFlag === 1 &&
              metaDataRowTotal !== 0 && (
                <div style={{ float: 'right', marginBottom: 30 }}>
                  <Pagination
                    onShowSizeChange={this.onShowSizeChange}
                    defaultPageSize={limitRows}
                    current={currentPage}
                    pageSize={metaDataPageSize}
                    total={metaDataRowTotal}
                    onChange={this.onShowSizeChange}
                    showSizeChanger
                    // hideOnSinglePage
                  />
                </div>
              )}
          </div>
          {reportTypeCode === 'C' && (
            <Spin spinning={buildReportLoading} style={{ width: '100%', height: '800px' }}>
              {buildReportLoading ||
                (EChartsVisible && (
                  <div
                    key={`${reportUuid}${chartType}${uuidKey}`}
                    className={styles['chart-report-view']}
                  >
                    <ReportView {...reportViewProps} />
                  </div>
                ))}
            </Spin>
          )}
        </div>
        {drawerProps && <Drawer {...drawerProps} />}
      </>
    );
  }
}
