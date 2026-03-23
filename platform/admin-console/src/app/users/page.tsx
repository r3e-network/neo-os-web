// =============================================================================
// Users Page
// =============================================================================

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useUsers, useSearchUsers } from "@/lib/hooks/useUsers";
import { formatDate, truncate } from "@/lib/utils";

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: allUsers, isLoading: allUsersLoading, error: allUsersError } = useUsers();
  const { data: searchResults, isLoading: searchLoading, error: searchError } = useSearchUsers(searchTerm);

  const users = searchTerm ? searchResults : allUsers;
  const isLoading = searchTerm ? searchLoading : allUsersLoading;
  const error = searchTerm ? searchError : allUsersError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage platform users</p>
      </div>

      <Card variant="glass">
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              type="search"
              id="user-search-input"
              placeholder="Search by address or email..."
              aria-label="Search users"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : error ? (
            <div role="alert" className="text-center text-danger-600 dark:text-danger-400">Failed to load users</div>
          ) : (
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
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium" title={user.id}>{truncate(user.id, 12)}</TableCell>
                    <TableCell className="font-mono text-sm">{user.address}</TableCell>
                    <TableCell className="text-sm text-gray-500 dark:text-gray-400">{user.email || "N/A"}</TableCell>
                    <TableCell className="text-sm text-gray-500 dark:text-gray-400">{formatDate(user.created_at)}</TableCell>
                    <TableCell className="text-sm text-gray-500 dark:text-gray-400">{formatDate(user.updated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}

          {!isLoading && users?.length === 0 && (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              {searchTerm ? "No users found matching your search" : "No users registered yet"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
