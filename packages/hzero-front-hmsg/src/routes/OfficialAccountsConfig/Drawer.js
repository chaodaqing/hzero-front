import React from 'react';
import { withRouter } from 'react-router';
import { Bind } from 'lodash-decorators';
import { Form, TextField, Switch, Select, Lov, Password, Spin } from 'choerodon-ui/pro';

import intl from 'utils/intl';
import { isTenantRoleLevel } from 'utils/utils';

@withRouter
export default class Drawer extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isSpin: false,
    };
  }

  async componentDidMount() {
    const { isEdit, isCopy, currentEditData, modalDS } = this.props;
    if (isEdit) {
      this.setState({
        isSpin: true,
      });
      await this.queryData();
    }
    if (isCopy) {
      modalDS.get(0).set('serverCode', currentEditData.serverCode);
      modalDS.get(0).set('serverName', currentEditData.serverName);
      modalDS.get(0).set('authType', currentEditData.authType);
      modalDS.get(0).set('enabledFlag', currentEditData.enabledFlag);
    }
  }

  /**
   * 获取需要编辑的模型类型数据
   */
  @Bind()
  async queryData() {
    const {
      currentEditData: { serverId },
      modalDS,
    } = this.props;
    modalDS.serverId = serverId;
    await modalDS.query().then((res) => {
      if (res) {
        this.setState({
          isSpin: false,
        });
      }
    });
  }

  render() {
    const { isEdit, modalDS } = this.props;
    const { isSpin } = this.state;
    return (
      <>
        <Spin spinning={isSpin}>
          <Form dataSet={modalDS} labelWidth={110}>
            {!isTenantRoleLevel() && <Lov name="tenantIdLov" disabled={isEdit} />}
            <TextField name="serverCode" disabled={isEdit} />
            <TextField name="serverName" />
            <Select name="authType" />
            <TextField name="appid" />
            <Password
              name="secret"
              placeholder={intl.get('hzero.common.validation.notChange').d('未更改')}
              maxLength={110}
            />
            <TextField name="authAddress" />
            <Switch name="enabledFlag" />
          </Form>
        </Spin>
      </>
    );
  }
}
