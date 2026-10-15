-- 2026-10-14 修复订单 100（ORD2110327564710551552）备注重复污染
-- 根因：后台「修改状态」弹窗把整条备注（含 META 块）作为新增备注回传，
--       appendAdminRemark 判定非完全重复即追加，3 次状态修改导致 remark 翻倍（1→2→4→8）。
-- 修复：保留 1 个 [CARPOOL_META] 块（网页端/小程序「顺风车信息」面板解析依赖），
--       正文去重为「网页乘客端下单 | 智能派单 | 退款原因：管理员发起退款」。
-- 回滚：本语句只覆盖 remark，如需回滚请从备份恢复该行。
UPDATE t_ride_order
SET remark = '[CARPOOL_META]{"departDate":"2026-10-14","timeRange":"21:00 - 24:00","passengerCount":1,"hasLuggage":false,"tollMode":"NEGOTIABLE","originalAmount":263.58,"discountAmount":52.72,"payableAmount":210.86,"note":""}[/CARPOOL_META]网页乘客端下单 | 智能派单 | 退款原因：管理员发起退款'
WHERE id = 100
  AND order_no = 'ORD2110327564710551552';
