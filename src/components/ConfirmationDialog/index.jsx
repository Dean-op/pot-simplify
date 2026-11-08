import React, { useContext, useEffect } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@nextui-org/react';
import { useTranslation } from 'react-i18next';
import { WindowCloseContext } from '../WindowControl/CloseGuard';

export default function ConfirmationDialog({
    isOpen,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
    isLoading = false,
}) {
    const { t } = useTranslation();
    const windowClose = useContext(WindowCloseContext);
    useEffect(() => {
        if (isOpen && isLoading) return windowClose?.register(() => {});
    }, [isOpen, isLoading, windowClose]);
    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={(open) => {
                if (!open && !isLoading) onCancel();
            }}
            isDismissable={!isLoading}
            isKeyboardDismissDisabled={isLoading}
            hideCloseButton={isLoading}
        >
            <ModalContent>
                <ModalHeader>{title}</ModalHeader>
                <ModalBody>{message}</ModalBody>
                <ModalFooter>
                    <Button
                        variant='light'
                        isDisabled={isLoading}
                        onPress={onCancel}
                    >
                        {cancelText ?? t('common.cancel')}
                    </Button>
                    <Button
                        color='danger'
                        isLoading={isLoading}
                        isDisabled={isLoading}
                        onPress={onConfirm}
                    >
                        {confirmText}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
