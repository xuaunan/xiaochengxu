package com.sunshine.travel.service;

import com.sunshine.travel.common.BusinessException;
import com.sunshine.travel.common.ErrorCode;
import com.sunshine.travel.common.InvoiceStatus;
import com.sunshine.travel.common.RoleCode;
import com.sunshine.travel.common.UserContext;
import com.sunshine.travel.entity.RideOrder;
import com.sunshine.travel.mapper.RideOrderMapper;
import com.sunshine.travel.util.InvoiceMetaUtil;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.imageio.ImageIO;
import java.awt.AlphaComposite;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Random;

@Service
public class InvoiceImageService {

    private static final int WIDTH = 1600;
    private static final int HEIGHT = 1050;
    private static final Color ORANGE = new Color(255, 105, 0);
    private static final Color SOFT_ORANGE = new Color(255, 246, 237);
    private static final Color BORDER = new Color(255, 180, 118);
    private static final Color TEXT = new Color(34, 34, 34);
    private static final Color MUTED = new Color(82, 82, 82);
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final RideOrderMapper rideOrderMapper;

    public InvoiceImageService(RideOrderMapper rideOrderMapper) {
        this.rideOrderMapper = rideOrderMapper;
    }

    public byte[] render(Long orderId, boolean adminAccess) {
        RideOrder order = rideOrderMapper.selectById(orderId);
        if (order == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "订单不存在");
        }
        if (!adminAccess && !RoleCode.ADMIN.equals(UserContext.role())) {
            Long currentUserId = UserContext.userId();
            if (currentUserId == null || !currentUserId.equals(order.getUserId())) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "只能查看自己的发票");
            }
        }
        if (!InvoiceStatus.ISSUED.equals(order.getInvoiceStatus())) {
            throw new BusinessException(ErrorCode.STATUS_ERROR, "发票尚未开具");
        }
        Map<String, Object> meta = new LinkedHashMap<>(InvoiceMetaUtil.parse(order.getRemark()));
        if (meta.isEmpty()) {
            meta.put("invoiceNo", order.getOrderNo());
            meta.put("invoiceCode", "031002" + order.getId());
            meta.put("invoiceDate", formatTime(order.getFinishedAt()));
        }
        return renderPng(order, meta);
    }

    private byte[] renderPng(RideOrder order, Map<String, Object> meta) {
        BufferedImage image = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, WIDTH, HEIGHT);

            drawHeader(g, meta);
            drawBaseLine(g, meta, order);
            drawBuyerSeller(g, meta);
            drawTrip(g, meta, order);
            drawFees(g, meta, order);
            drawRemarkAndStamp(g, meta);
        } finally {
            g.dispose();
        }
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            ImageIO.write(image, "png", output);
            return output.toByteArray();
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "发票图片生成失败");
        }
    }

    private void drawHeader(Graphics2D g, Map<String, Object> meta) {
        g.setColor(ORANGE);
        g.setFont(font(Font.BOLD, 68));
        drawCentered(g, "阳光出行", WIDTH / 2, 84);
        g.setColor(TEXT);
        g.setFont(font(Font.PLAIN, 38));
        drawCentered(g, text(meta, "sellerName", "北京阳光出行有限公司"), WIDTH / 2, 132);

        g.setColor(ORANGE);
        round(g, WIDTH / 2 - 182, 152, 364, 48, 12, ORANGE, ORANGE);
        g.setColor(Color.WHITE);
        g.setFont(font(Font.BOLD, 28));
        drawCentered(g, "电子发票（打车出行）", WIDTH / 2, 185);

        g.setStroke(new BasicStroke(4));
        g.setColor(ORANGE);
        g.drawLine(38, 138, 452, 138);
        g.drawLine(WIDTH - 452, 138, WIDTH - 38, 138);
        g.drawLine(38, 286, WIDTH - 38, 286);
    }

    private void drawBaseLine(Graphics2D g, Map<String, Object> meta, RideOrder order) {
        int y = 222;
        int[] xs = {100, 405, 690, 955, 1270};
        String[][] items = {
                {"发票代码", text(meta, "invoiceCode", "031002" + safe(order.getId()))},
                {"发票号码", text(meta, "invoiceNo", safe(order.getOrderNo()))},
                {"开票日期", text(meta, "issueAt", text(meta, "invoiceDate", formatTime(order.getFinishedAt())))},
                {"订单编号", text(meta, "orderNo", safe(order.getOrderNo()))},
                {"发票类型", text(meta, "invoiceType", "电子普通发票")}
        };
        for (int i = 0; i < items.length; i++) {
            drawSmallIcon(g, xs[i] - 48, y - 18, i);
            g.setColor(TEXT);
            g.setFont(font(Font.PLAIN, 20));
            g.drawString(items[i][0], xs[i] + 12, y);
            g.setFont(font(Font.PLAIN, i == 3 ? 15 : 21));
            drawEllipsis(g, items[i][1], xs[i] + 12, y + 30, i == 4 ? 190 : (i == 3 ? 285 : 230));
            if (i < items.length - 1) {
                g.setColor(new Color(210, 210, 210));
                g.drawLine(xs[i] + 195, y - 30, xs[i] + 195, y + 42);
            }
        }
    }

    private void drawBuyerSeller(Graphics2D g, Map<String, Object> meta) {
        drawInfoBox(g, 38, 304, 742, 156, "购买方信息", new String[][]{
                {"名称", text(meta, "buyerName", text(meta, "title", "个人"))},
                {"纳税人识别号", text(meta, "buyerTaxNo", text(meta, "taxNo", "个人无需填写"))},
                {"联系电话", text(meta, "buyerPhone", "13800000000")}
        });
        drawInfoBox(g, 802, 304, 760, 156, "销售方信息", new String[][]{
                {"名称", text(meta, "sellerName", "北京阳光出行有限公司")},
                {"纳税人识别号", text(meta, "sellerTaxNo", "91110105MA01SUN8X9")},
                {"联系电话", text(meta, "sellerPhone", "400-100-0101")}
        });
    }

    private void drawTrip(Graphics2D g, Map<String, Object> meta, RideOrder order) {
        round(g, 38, 478, 1524, 136, 8, Color.WHITE, BORDER);
        sectionTitle(g, "行程信息", 66, 514);
        String[] heads = {"乘车人", "用车时间", "上车地点", "下车地点", "车型", "行程里程", "行程时长", "支付方式"};
        String[] values = {
                text(meta, "passengerName", "阳光乘客"),
                text(meta, "tripTime", formatTime(order.getFinishedAt())),
                text(meta, "startName", safe(order.getStartName())),
                text(meta, "endName", safe(order.getEndName())),
                text(meta, "carTypeName", text(meta, "serviceName", "经济型")),
                distanceText(meta, order),
                durationText(meta, order),
                text(meta, "payChannel", "WECHAT")
        };
        int[] widths = {135, 215, 270, 290, 135, 150, 150, 160};
        int x = 50;
        int headY = 522;
        int rowY = 562;
        g.setFont(font(Font.PLAIN, 20));
        for (int i = 0; i < heads.length; i++) {
            g.setColor(new Color(248, 248, 248));
            g.fillRect(x, headY, widths[i], 38);
            g.setColor(new Color(198, 198, 198));
            g.drawRect(x, headY, widths[i], 76);
            g.setColor(TEXT);
            drawCentered(g, heads[i], x + widths[i] / 2, headY + 27);
            drawEllipsisCentered(g, values[i], x + widths[i] / 2, rowY + 27, widths[i] - 12);
            x += widths[i];
        }
    }

    private void drawFees(Graphics2D g, Map<String, Object> meta, RideOrder order) {
        round(g, 38, 632, 1114, 274, 8, Color.WHITE, BORDER);
        sectionTitle(g, "费用明细", 66, 670);
        String total = amount(meta, order).toPlainString();
        String coupon = discountText(decimal(text(meta, "couponDiscount", "0")));
        String[][] rows = {
                {"出行服务费", "次", "1", total, total},
                {"里程服务", "公里", decimal(text(meta, "distanceKm", "0")).toPlainString(), "0.00", "0.00"},
                {"时长服务", "分钟", decimal(text(meta, "durationMin", "0")).setScale(0, RoundingMode.HALF_UP).toPlainString(), "0.00", "0.00"},
                {"优惠抵扣", "次", "1", coupon, coupon},
                {"平台服务", "次", "1", "0.00", "0.00"}
        };
        String[] heads = {"项目", "单位", "数量", "单价（元）", "金额（元）"};
        int[] widths = {300, 190, 195, 235, 194};
        int x = 50;
        int y = 684;
        for (int i = 0; i < heads.length; i++) {
            g.setColor(new Color(248, 248, 248));
            g.fillRect(x, y, widths[i], 38);
            g.setColor(new Color(198, 198, 198));
            g.drawRect(x, y, widths[i], 38);
            g.setColor(TEXT);
            g.setFont(font(Font.PLAIN, 20));
            drawCentered(g, heads[i], x + widths[i] / 2, y + 27);
            x += widths[i];
        }
        for (int r = 0; r < rows.length; r++) {
            x = 50;
            int rowY = y + 38 + r * 38;
            for (int c = 0; c < heads.length; c++) {
                g.setColor(Color.WHITE);
                g.fillRect(x, rowY, widths[c], 38);
                g.setColor(new Color(210, 210, 210));
                g.drawRect(x, rowY, widths[c], 38);
                g.setColor(TEXT);
                g.setFont(font(Font.PLAIN, 20));
                drawEllipsisCentered(g, rows[r][c], x + widths[c] / 2, rowY + 27, widths[c] - 12);
                x += widths[c];
            }
        }

        round(g, 1162, 632, 400, 274, 8, Color.WHITE, BORDER);
        g.setColor(TEXT);
        g.setFont(font(Font.PLAIN, 24));
        drawCentered(g, "价税合计（小写）", 1362, 690);
        g.setColor(ORANGE);
        g.setFont(font(Font.BOLD, 58));
        drawCentered(g, "¥" + total, 1362, 765);
        g.setStroke(new BasicStroke(2, BasicStroke.CAP_BUTT, BasicStroke.JOIN_BEVEL, 0, new float[]{6, 8}, 0));
        g.setColor(BORDER);
        g.drawLine(1180, 792, 1542, 792);
        g.setStroke(new BasicStroke(1));
        g.setColor(TEXT);
        g.setFont(font(Font.PLAIN, 24));
        drawCentered(g, "价税合计（大写）", 1362, 830);
        g.setFont(font(Font.PLAIN, 28));
        drawCentered(g, amountUpper(amount(meta, order)), 1362, 874);
    }

    private void drawRemarkAndStamp(Graphics2D g, Map<String, Object> meta) {
        round(g, 38, 928, 1230, 82, 6, Color.WHITE, BORDER);
        sectionTitle(g, "备注", 66, 966);
        g.setColor(TEXT);
        g.setFont(font(Font.PLAIN, 22));
        drawEllipsis(g, text(meta, "remark", "本发票为打车出行电子发票。"), 60, 998, 1120);

        drawRealisticStamp(g, 1392, 920);
    }

    private void drawRealisticStamp(Graphics2D g, int cx, int cy) {
        int size = 176;
        int center = size / 2;
        int radius = 70;
        Random random = new Random(20260520L);
        BufferedImage stamp = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
        Graphics2D sg = stamp.createGraphics();
        try {
            sg.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            sg.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

            for (int i = 0; i < 110; i++) {
                int alpha = 120 + random.nextInt(92);
                int red = 198 + random.nextInt(38);
                int offsetX = random.nextInt(7) - 3;
                int offsetY = random.nextInt(7) - 3;
                int arcRadius = radius + random.nextInt(5) - 2;
                sg.setColor(new Color(red, 34 + random.nextInt(18), 34 + random.nextInt(18), alpha));
                sg.setStroke(new BasicStroke(2.2f + random.nextFloat() * 3.8f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
                sg.drawArc(center - arcRadius + offsetX, center - arcRadius + offsetY, arcRadius * 2, arcRadius * 2,
                        random.nextInt(360), 5 + random.nextInt(20));
            }

            sg.setColor(new Color(214, 42, 42, 155));
            sg.setStroke(new BasicStroke(4.6f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
            sg.drawOval(center - radius, center - radius, radius * 2, radius * 2);
            sg.setColor(new Color(214, 42, 42, 90));
            sg.setStroke(new BasicStroke(2.1f));
            sg.drawOval(center - radius + 10, center - radius + 10, (radius - 10) * 2, (radius - 10) * 2);

            sg.setColor(new Color(218, 38, 38, 188));
            drawStampArcText(sg, "北京阳光出行有限公司", center, center, radius - 14, 210, 120, font(Font.BOLD, 15));
            sg.setFont(font(Font.BOLD, 32));
            drawCentered(sg, "★", center, center + 12);
            sg.setFont(font(Font.BOLD, 21));
            drawCentered(sg, "发票专用章", center, center + 53);

            sg.setComposite(AlphaComposite.Clear);
            for (int i = 0; i < 170; i++) {
                int dot = 1 + random.nextInt(4);
                sg.fillOval(18 + random.nextInt(size - 36), 16 + random.nextInt(size - 32), dot, dot);
            }
            for (int i = 0; i < 16; i++) {
                sg.setStroke(new BasicStroke(1.2f + random.nextFloat() * 1.8f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
                int x = 20 + random.nextInt(size - 42);
                int y = 20 + random.nextInt(size - 42);
                sg.drawLine(x, y, x + random.nextInt(30) - 15, y + random.nextInt(24) - 12);
            }
        } finally {
            sg.dispose();
        }

        AffineTransform oldTransform = g.getTransform();
        try {
            g.rotate(Math.toRadians(-7.5), cx, cy);
            g.drawImage(stamp, cx - size / 2, cy - size / 2, null);
        } finally {
            g.setTransform(oldTransform);
        }
    }

    private void drawStampArcText(Graphics2D g, String text, int cx, int cy, int radius, double startDegrees, double sweepDegrees, Font font) {
        AffineTransform oldTransform = g.getTransform();
        Font oldFont = g.getFont();
        try {
            g.setFont(font);
            FontMetrics metrics = g.getFontMetrics();
            int count = text.length();
            double step = count <= 1 ? 0 : Math.toRadians(sweepDegrees) / (count - 1);
            double start = Math.toRadians(startDegrees);
            for (int i = 0; i < count; i++) {
                String ch = text.substring(i, i + 1);
                double theta = start + step * i;
                double x = cx + Math.cos(theta) * radius;
                double y = cy + Math.sin(theta) * radius;
                AffineTransform letterTransform = g.getTransform();
                g.translate(x, y);
                g.rotate(theta + Math.PI / 2);
                g.drawString(ch, -metrics.stringWidth(ch) / 2, metrics.getAscent() / 2);
                g.setTransform(letterTransform);
            }
        } finally {
            g.setFont(oldFont);
            g.setTransform(oldTransform);
        }
    }

    private void drawInfoBox(Graphics2D g, int x, int y, int w, int h, String title, String[][] rows) {
        round(g, x, y, w, h, 8, Color.WHITE, BORDER);
        sectionTitle(g, title, x + 30, y + 38);
        g.setFont(font(Font.PLAIN, 21));
        int rowY = y + 72;
        for (String[] row : rows) {
            g.setColor(TEXT);
            g.drawString(row[0] + "：", x + 30, rowY);
            drawEllipsis(g, row[1], x + 150, rowY, w - 180);
            rowY += 34;
        }
    }

    private void sectionTitle(Graphics2D g, String title, int x, int baseline) {
        g.setColor(ORANGE);
        g.fillOval(x - 4, baseline - 26, 26, 26);
        g.setColor(ORANGE);
        g.setFont(font(Font.BOLD, 26));
        g.drawString(title, x + 36, baseline);
    }

    private void drawSmallIcon(Graphics2D g, int x, int y, int index) {
        g.setColor(ORANGE);
        g.setStroke(new BasicStroke(2));
        g.drawOval(x, y, 48, 48);
        g.setFont(font(Font.BOLD, 24));
        String[] icons = {"票", "#", "日", "单", "类"};
        drawCentered(g, icons[Math.min(index, icons.length - 1)], x + 24, y + 33);
    }

    private void round(Graphics2D g, int x, int y, int w, int h, int radius, Color fill, Color stroke) {
        g.setColor(fill);
        g.fillRoundRect(x, y, w, h, radius, radius);
        g.setColor(stroke);
        g.setStroke(new BasicStroke(1.2f));
        g.drawRoundRect(x, y, w, h, radius, radius);
    }

    private void drawCentered(Graphics2D g, String text, int centerX, int baseline) {
        FontMetrics metrics = g.getFontMetrics();
        g.drawString(text, centerX - metrics.stringWidth(text) / 2, baseline);
    }

    private void drawEllipsisCentered(Graphics2D g, String text, int centerX, int baseline, int maxWidth) {
        String fitted = fitText(g, text, maxWidth);
        drawCentered(g, fitted, centerX, baseline);
    }

    private void drawEllipsis(Graphics2D g, String text, int x, int baseline, int maxWidth) {
        g.drawString(fitText(g, text, maxWidth), x, baseline);
    }

    private String fitText(Graphics2D g, String text, int maxWidth) {
        String value = safe(text);
        if (g.getFontMetrics().stringWidth(value) <= maxWidth) {
            return value;
        }
        while (value.length() > 1 && g.getFontMetrics().stringWidth(value + "...") > maxWidth) {
            value = value.substring(0, value.length() - 1);
        }
        return value + "...";
    }

    private Font font(int style, int size) {
        return new Font("Microsoft YaHei", style, size);
    }

    private String text(Map<String, Object> meta, String key, String fallback) {
        Object value = meta.get(key);
        String text = value == null ? "" : String.valueOf(value).trim();
        return StringUtils.hasText(text) ? text : fallback;
    }

    private String distanceText(Map<String, Object> meta, RideOrder order) {
        String distance = text(meta, "distanceKm", order.getActualDistanceKm() == null ? "" : order.getActualDistanceKm().toPlainString());
        return decimal(distance).setScale(1, RoundingMode.HALF_UP).toPlainString() + " 公里";
    }

    private String durationText(Map<String, Object> meta, RideOrder order) {
        String duration = text(meta, "durationMin", order.getActualDurationMin() == null ? "" : order.getActualDurationMin().toPlainString());
        return decimal(duration).setScale(0, RoundingMode.HALF_UP).toPlainString() + " 分钟";
    }

    private BigDecimal amount(Map<String, Object> meta, RideOrder order) {
        String amount = text(meta, "totalAmount", "");
        if (StringUtils.hasText(amount)) {
            return decimal(amount);
        }
        BigDecimal value = order.getActualAmount() != null ? order.getActualAmount() : order.getPayableAmount();
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal decimal(String value) {
        try {
            return new BigDecimal(StringUtils.hasText(value) ? value.replace("¥", "").replace("元", "").trim() : "0")
                    .setScale(2, RoundingMode.HALF_UP);
        } catch (Exception ex) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
    }

    private String discountText(BigDecimal value) {
        BigDecimal normalized = value == null ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP) : value.setScale(2, RoundingMode.HALF_UP);
        if (BigDecimal.ZERO.compareTo(normalized) == 0) {
            return "0.00";
        }
        return "-" + normalized.abs().toPlainString();
    }

    private String amountUpper(BigDecimal amount) {
        String[] digits = {"零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"};
        String[] units = {"", "拾", "佰", "仟"};
        BigDecimal scaled = amount.abs().setScale(2, RoundingMode.HALF_UP);
        long cents = scaled.movePointRight(2).longValue();
        long yuan = cents / 100;
        int jiao = (int) ((cents / 10) % 10);
        int fen = (int) (cents % 10);
        if (yuan == 0 && jiao == 0 && fen == 0) {
            return "零元整";
        }
        String yuanText = "";
        char[] chars = String.valueOf(yuan).toCharArray();
        for (int i = 0; i < chars.length; i++) {
            int digit = chars[i] - '0';
            int pos = chars.length - i - 1;
            if (digit == 0) {
                if (!yuanText.endsWith("零") && !yuanText.isEmpty()) {
                    yuanText += "零";
                }
            } else {
                yuanText += digits[digit] + units[pos % 4];
            }
            if (pos == 4) {
                yuanText += "万";
            }
        }
        yuanText = yuanText.replaceAll("零+$", "");
        String result = (StringUtils.hasText(yuanText) ? yuanText : "零") + "元";
        if (jiao == 0 && fen == 0) {
            return result + "整";
        }
        if (jiao > 0) {
            result += digits[jiao] + "角";
        }
        if (fen > 0) {
            result += digits[fen] + "分";
        }
        return result;
    }

    private String formatTime(LocalDateTime value) {
        return value == null ? LocalDateTime.now().format(DATE_TIME_FORMATTER) : value.format(DATE_TIME_FORMATTER);
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value);
    }
}
