import React, { useContext, useEffect } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Spacer } from '@nextui-org/react';
import { useTranslation } from 'react-i18next';
import { ServiceDialogContext, useServiceDialog } from '../../hooks/useServiceDialog';
import { WindowCloseContext } from '../WindowControl/CloseGuard';

export default function ServiceConfigModal({
    isOpen,
    onOpenChange,
    instanceKey,
    ConfigComponent,
    updateServiceList,
    title,
    icon,
}) {
    const { t } = useTranslation();
    const dialog = useServiceDialog(() => onOpenChange(false));
    const windowClose = useContext(WindowCloseContext);

    useEffect(() => {
        if (isOpen) return windowClose?.register(dialog.requestClose);
    }, [isOpen, windowClose, dialog.requestClose]);

    return (
        <ServiceDialogContext.Provider value={dialog}>
            <Modal
                isOpen={isOpen}
                onOpenChange={(open) => {
                    if (!open) dialog.requestClose();
                }}
                isDismissable={!dialog.isSaving}
                isKeyboardDismissDisabled={dialog.isSaving}
                hideCloseButton={dialog.isSaving}
                scrollBehavior='inside'
                size='2xl'
            >
                <ModalContent className='max-h-[75vh]'>
                    <ModalHeader>
                        <img
                            src={icon}
                            alt=''
                            className='h-[24px] w-[24px] my-auto'
                            draggable={false}
                        />
                        <Spacer x={2} />
                        {title}
                    </ModalHeader>
                    <ModalBody>
                        {isOpen && (
                            <ConfigComponent
                                key={instanceKey}
                                instanceKey={instanceKey}
                                updateServiceList={updateServiceList}
                                onClose={() => onOpenChange(false)}
                            />
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            color='danger'
                            variant='light'
                            isDisabled={dialog.isSaving}
                            onPress={() => dialog.requestClose()}
                        >
                            {t('common.cancel')}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </ServiceDialogContext.Provider>
    );
}
