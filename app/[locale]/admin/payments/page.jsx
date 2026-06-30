import { getAdminUser } from "@/lib/admin-utils";
import { getPaymentsForAdmin } from "@/queries/payments-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/formatPrice";
import { format } from "date-fns";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, DollarSign, CreditCard, TrendingUp } from "lucide-react";
import { getTranslations } from "next-intl/server";

export const metadata = {
    title: "Payments - Admin",
    description: "View and manage all payments"
};

export default async function PaymentsPage({ searchParams }) {
    await getAdminUser();
    const t = await getTranslations("Admin");
    const params = await searchParams;
    const page = parseInt(params.page) || 1;
    const pageSize = 20;
    const status = params.status || 'all';
    
    const { payments, total, totalPages } = await getPaymentsForAdmin({
        page,
        pageSize,
        status: status !== 'all' ? status : undefined
    });
    
    // Calculate summary stats
    const totalRevenue = payments
        .filter(p => p.status === 'succeeded')
        .reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const totalPayments = payments.length;
    const succeededPayments = payments.filter(p => p.status === 'succeeded').length;
    const failedPayments = payments.filter(p => p.status === 'failed').length;
    const refundedPayments = payments.filter(p => p.status === 'refunded' || p.status === 'partially_refunded').length;
    
    const statusColors = {
        succeeded: 'bg-green-100 text-green-800',
        pending: 'bg-yellow-100 text-yellow-800',
        failed: 'bg-red-100 text-red-800',
        refunded: 'bg-gray-100 text-gray-800',
        partially_refunded: 'bg-orange-100 text-orange-800',
        canceled: 'bg-gray-100 text-gray-800'
    };
    
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t("paymentsTitle")}</h1>
                    <p className="text-gray-600 mt-2">{t("paymentsSub")}</p>
                </div>
                <Link href="/admin">
                    <Button variant="outline">
                        <ArrowLeft className="w-4 h-4 me-2 rtl:rotate-180" />
                        {t("backToDashboard")}
                    </Button>
                </Link>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">{t("totalRevenue")}</CardTitle>
                        <DollarSign className="h-5 w-5 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold" suppressHydrationWarning>{formatPrice(totalRevenue)}</div>
                        <p className="text-xs text-gray-500 mt-1">{t("fromSuccessfulPayments")}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">{t("totalPayments")}</CardTitle>
                        <CreditCard className="h-5 w-5 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalPayments}</div>
                        <p className="text-xs text-gray-500 mt-1">{t("allTransactions")}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">{t("succeeded")}</CardTitle>
                        <TrendingUp className="h-5 w-5 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{succeededPayments}</div>
                        <p className="text-xs text-gray-500 mt-1">{t("successfulPayments")}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">{t("failedRefunded")}</CardTitle>
                        <CreditCard className="h-5 w-5 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{failedPayments + refundedPayments}</div>
                        <p className="text-xs text-gray-500 mt-1">{t("failedOrRefunded")}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Payments Table */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("paymentTransactions")}</CardTitle>
                </CardHeader>
                <CardContent>
                    {payments.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500">{t("noPaymentsFound")}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-start p-4 font-medium">{t("user")}</th>
                                        <th className="text-start p-4 font-medium">{t("course")}</th>
                                        <th className="text-start p-4 font-medium">{t("amount")}</th>
                                        <th className="text-start p-4 font-medium">{t("status")}</th>
                                        <th className="text-start p-4 font-medium">{t("date")}</th>
                                        <th className="text-start p-4 font-medium">{t("sessionId")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((payment) => (
                                        <tr key={payment.id || payment._id} className="border-b hover:bg-gray-50">
                                            <td className="p-4">
                                                <div>
                                                    <div className="font-medium">
                                                        {payment.user?.firstName} {payment.user?.lastName}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {payment.user?.email}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <Link 
                                                    href={`/admin/courses/${payment.course?.id || payment.course?._id}`}
                                                    className="text-blue-600 hover:underline"
                                                >
                                                    {payment.course?.title || t("unknownCourse")}
                                                </Link>
                                            </td>
                                            <td className="p-4 font-medium" suppressHydrationWarning>
                                                {formatPrice(payment.amount)} {payment.currency || 'USD'}
                                            </td>
                                            <td className="p-4">
                                                <Badge className={statusColors[payment.status] || 'bg-gray-100 text-gray-800'}>
                                                    {payment.status}
                                                </Badge>
                                            </td>
                                            <td className="p-4 text-sm text-gray-600">
                                                {payment.paidAt 
                                                    ? format(new Date(payment.paidAt), 'MMM dd, yyyy HH:mm')
                                                    : payment.createdAt
                                                    ? format(new Date(payment.createdAt), 'MMM dd, yyyy HH:mm')
                                                    : 'N/A'
                                                }
                                            </td>
                                            <td className="p-4">
                                                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                                                    {payment.sessionId?.substring(0, 20)}...
                                                </code>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            
                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4">
                                    <div className="text-sm text-gray-600">
                                        {t("pageOfTotal", { page, totalPages, total })}
                                    </div>
                                    <div className="flex gap-2">
                                        {page > 1 && (
                                            <Link href={`/admin/payments?page=${page - 1}${status !== 'all' ? `&status=${status}` : ''}`}>
                                                <Button variant="outline" size="sm">{t("previous")}</Button>
                                            </Link>
                                        )}
                                        {page < totalPages && (
                                            <Link href={`/admin/payments?page=${page + 1}${status !== 'all' ? `&status=${status}` : ''}`}>
                                                <Button variant="outline" size="sm">{t("next")}</Button>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

