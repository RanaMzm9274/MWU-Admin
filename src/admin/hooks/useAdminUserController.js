import { apiUrl, getAuthHeaders, readApiError, normalizeAdminUser, storeAdminProfile, storeAdminUsers } from "../runtime/portalRuntime";
import { readOptionalJson } from "../runtime/pageRuntime";

export default function useAdminUserController({
  requireAnyPortalAccess, adminToken, adminUsers, setAdminUsers, adminProfile, setAdminProfile, setNotice
}) {
  const saveAdminUser = async (userInput) => {
    if (!requireAnyPortalAccess(["users"], "User management")) {  
      return null;  
    }  
    const isExistingUser = Boolean(userInput.id) && adminUsers.some((user) => String(user.id) === String(userInput.id));  
    const response = await fetch(apiUrl(isExistingUser ? `/admin/users/${encodeURIComponent(userInput.id)}` : "/admin/users"), {  
      method: isExistingUser ? "PUT" : "POST",  
      headers: {  
        "Content-Type": "application/json",  
        ...getAuthHeaders(adminToken)  
      },  
      body: JSON.stringify({  
        name: userInput.name,  
        email: userInput.email,  
        role: userInput.role,  
        status: userInput.status,  
        department: userInput.department,  
        access: userInput.access,  
        temporaryPassword: userInput.temporaryPassword,  
        sendInvite: Boolean(userInput.sendInvite)  
      })  
    });  
    
    if (!response.ok) {  
      throw new Error(await readApiError(response, "User save failed."));  
    }  
    
    const payload = await readOptionalJson(response);  
    const savedUser = normalizeAdminUser(payload?.user || payload?.data?.user || payload?.data || payload);  
    
    setAdminUsers((current) => {  
      const exists = current.some((user) => String(user.id) === String(savedUser.id));  
      const nextUsers = exists  
        ? current.map((user) => (String(user.id) === String(savedUser.id) ? savedUser : user))  
        : [savedUser, ...current];  
      storeAdminUsers(nextUsers);  
      return nextUsers;  
    });  
    
    if (adminProfile && (String(adminProfile.id) === String(savedUser.id) || adminProfile.email === savedUser.email)) {  
      setAdminProfile(savedUser);  
      storeAdminProfile(savedUser);  
    }  
    
    const temporaryPassword = payload?.temporaryPassword;  
    const inviteSent = Boolean(payload?.invite?.sent);  
    setNotice(  
      inviteSent  
        ? "User saved and invitation email sent."  
        : temporaryPassword  
          ? `User saved. SMTP is not configured, temporary password: ${temporaryPassword}`  
          : "User saved to the database."  
    );  
    return savedUser;  
  };  
    
  const sendAdminUserInvite = async (userId) => {  
    if (!requireAnyPortalAccess(["users"], "User invitations")) {  
      return null;  
    }  
    const response = await fetch(apiUrl(`/admin/users/${encodeURIComponent(userId)}/invite`), {  
      method: "POST",  
      headers: getAuthHeaders(adminToken)  
    });  
    
    if (!response.ok) {  
      throw new Error(await readApiError(response, "Invite email failed."));  
    }  
    
    const payload = await readOptionalJson(response);  
    const savedUser = normalizeAdminUser(payload?.user || payload?.data?.user || payload?.data || payload);  
    setAdminUsers((current) => {  
      const nextUsers = current.map((user) => (String(user.id) === String(savedUser.id) ? savedUser : user));  
      storeAdminUsers(nextUsers);  
      return nextUsers;  
    });  
    
    const temporaryPassword = payload?.temporaryPassword;  
    setNotice(  
      payload?.invite?.sent  
        ? "Invitation email sent."  
        : temporaryPassword  
          ? `SMTP is not configured, temporary password: ${temporaryPassword}`  
          : "Invite request completed."  
    );  
    return savedUser;  
  };  
    
  const deleteAdminUser = async (userId) => {  
    if (!requireAnyPortalAccess(["users"], "User deletion")) {  
      return;  
    }  
    if (adminProfile && String(adminProfile.id) === String(userId)) {  
      setNotice("You cannot delete the currently signed-in user.");  
      return;  
    }  
    
    const response = await fetch(apiUrl(`/admin/users/${encodeURIComponent(userId)}`), {  
      method: "DELETE",  
      headers: getAuthHeaders(adminToken)  
    });  
    
    if (!response.ok) {  
      throw new Error(await readApiError(response, "User delete failed."));  
    }  
    
    setAdminUsers((current) => {  
      const nextUsers = current.filter((user) => String(user.id) !== String(userId));  
      storeAdminUsers(nextUsers);  
      return nextUsers;  
    });  
    setNotice("User removed.");  
  };  
    

  return { saveAdminUser, sendAdminUserInvite, deleteAdminUser };
}
