package com.sunshine.travel.service.support;

import com.sunshine.travel.common.UserContext;
import com.sunshine.travel.entity.OperationLog;
import com.sunshine.travel.mapper.OperationLogMapper;
import org.springframework.stereotype.Component;

@Component
public class OperationLogSupport {

    private final OperationLogMapper operationLogMapper;

    public OperationLogSupport(OperationLogMapper operationLogMapper) {
        this.operationLogMapper = operationLogMapper;
    }

    public void log(String module, String action, String targetType, Long targetId, String content) {
        OperationLog operationLog = new OperationLog();
        operationLog.setOperatorId(UserContext.userId());
        operationLog.setOperatorRole(UserContext.role());
        operationLog.setBizModule(module);
        operationLog.setBizAction(action);
        operationLog.setTargetType(targetType);
        operationLog.setTargetId(targetId);
        operationLog.setContent(content);
        operationLogMapper.insert(operationLog);
    }
}
