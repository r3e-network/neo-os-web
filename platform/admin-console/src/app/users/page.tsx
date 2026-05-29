// =============================================================================
// Users Page
// =============================================================================

"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { useUsers, useSearchUsers } from "@/lib/hooks/useUsers";
import { formatDate, truncate } from "@/lib/utils";

function safeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const {
    data: allUsers,
    isLoading: allUsersLoading,
    error: allUsersError,
  } = useUsers();
  const {
    data: searchResults,
    isLoading: searchLoading,
    error: searchError,
  } = useSearchUsers(searchTerm);

  const users = searchTerm ? searchResults : allUsers;
  const isLoading = searchTerm ? searchLoading : allUsersLoading;
  const error = searchTerm ? searchError : allUsersError;
  const visibleUsers = Array.isArray(users) ? users : [];
  const emailCoverage = visibleUsers.filter((user) => safeText(user.email)).length;
  const searchModeLabel = searchTerm ? "Search active" : "All users";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage platform users"
        highlightLastWord
      />

      <div
        aria-label="User directory summary"
        className="users-summary-grid grid gap-3 sm:grid-cols-3"
      >
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">
            Visible Users
          </p>
          <p className="mt-2 text-2xl font-black text-gray-950">
            {visibleUsers.length}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">
            Email Coverage
          </p>
          <p className="mt-2 text-2xl font-black text-gray-950">
            {emailCoverage}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">
            Search Mode
          </p>
          <p className="mt-2 text-sm font-semibold text-gray-700">
            {searchModeLabel}
          </p>
          {searchTerm ? (
            <p className="mt-1 text-xs text-gray-500">
              Showing {visibleUsers.length} result for {searchTerm}
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-500">All users</p>
          )}
        </div>
      </div>

      <Card
        aria-label="User management panel"
        className="users-management-card"
        variant="default"
      >
        <CardHeader>
          <CardTitle>User Directory</CardTitle>
          <p className="mt-1 text-sm text-gray-500">
            Search by address or email, then review metadata and activity timestamps.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Input
              type="search"
              id="user-search-input"
              placeholder="Search by address or email..."
              aria-label="Search users"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {isLoading && (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          )}

          {!isLoading && error && (
            <div
              role="alert"
              aria-label="User directory could not be loaded"
              className="rounded-xl border border-danger-200 bg-danger-50 p-4"
            >
              <p className="text-sm font-semibold text-danger-700">
                User directory could not be loaded
              </p>
            </div>
          )}

          {!isLoading && !error && (
            <>
              <div
                aria-label="Mobile users list"
                className="users-mobile-list space-y-3 md:hidden"
              >
                {visibleUsers.map((user) => (
                  <div
                    key={user.id}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <p className="text-sm font-semibold text-gray-900">
                      {safeText(user.email) || "No email on file"}
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-gray-600">
                      {user.address}
                    </p>
                    <div className="mt-4 grid gap-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600 sm:grid-cols-2">
                      <div>
                        <p className="font-semibold uppercase text-gray-500">
                          Created
                        </p>
                        <p className="mt-1 font-medium text-gray-700">
                          {formatDate(user.created_at)}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold uppercase text-gray-500">
                          Updated
                        </p>
                        <p className="mt-1 font-medium text-gray-700">
                          {formatDate(user.updated_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="users-desktop-table hidden md:block">
                <div className="overflow-x-auto">
                  <Table aria-label="Users list">
                    <TableHeader>
                      <TableRow>
                        <TableHead>User ID</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium" title={user.id}>
                            {truncate(user.id, 12)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {user.address}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {safeText(user.email) || "No email on file"}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {formatDate(user.created_at)}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {formatDate(user.updated_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {visibleUsers.length === 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
                  {searchTerm
                    ? "No users found matching your search"
                    : "No users registered yet"}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
