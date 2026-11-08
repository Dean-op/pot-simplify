import React from 'react';
import { useTranslation } from 'react-i18next';
import * as builtinServices from '../../../../../../services/recognize';
import { getServiceName } from '../../../../../../utils/service_instance';
import ServiceConfigModal from '../../../../../../components/ServiceConfigModal';

export default function ConfigModal({ serviceInstanceKey, isOpen, onOpenChange, updateServiceInstanceList }) {
    const { t } = useTranslation();
    const serviceName = getServiceName(serviceInstanceKey);
    return (
        <ServiceConfigModal
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            instanceKey={serviceInstanceKey}
            ConfigComponent={builtinServices[serviceName].Config}
            updateServiceList={updateServiceInstanceList}
            title={t('services.recognize.' + serviceName + '.title')}
            icon={serviceName === 'system' ? 'logo/Windows_NT.svg' : builtinServices[serviceName].info.icon}
        />
    );
}
