package com.sunshine.travel.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sunshine.travel.common.BusinessException;
import org.junit.jupiter.api.Test;

class ProfileFieldGuardTests {

    @Test
    void sanitizeRequiredShouldTrimNormalText() {
        assertEquals("小阳乘客", ProfileFieldGuard.sanitizeRequired("昵称", "  小阳乘客  "));
    }

    @Test
    void sanitizeOptionalShouldKeepBlankValue() {
        assertEquals("", ProfileFieldGuard.sanitizeOptional("紧急联系人", "   "));
    }

    @Test
    void sanitizeRequiredShouldRejectQuestionMarkPlaceholder() {
        BusinessException error = assertThrows(BusinessException.class,
                () -> ProfileFieldGuard.sanitizeRequired("昵称", "????"));
        assertEquals("昵称包含异常字符，请检查输入法或编码设置后重试", error.getMessage());
    }

    @Test
    void sanitizeOptionalShouldRejectReplacementCharacters() {
        BusinessException error = assertThrows(BusinessException.class,
                () -> ProfileFieldGuard.sanitizeOptional("真实姓名", "陈�阳"));
        assertEquals("真实姓名包含异常字符，请检查输入法或编码设置后重试", error.getMessage());
    }
}
