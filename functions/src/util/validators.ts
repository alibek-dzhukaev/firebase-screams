export const isEmpty = (str: string): boolean => !str.trim();

export const isEmail = (email: string): boolean => {
  const regEx = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return !!email.match(regEx);
};

type ValidateResponse = {
  errors: Record<string, string>
  valid: boolean
}

export const validateSignupData = (data: Record<string, string>): ValidateResponse => {
  const errors = {} as Record<string, string>;

  if (isEmpty(data.email)) {
    errors.email = "Must not be empty";
  } else if (!isEmail(data.email)) {
    errors.email = "Must be a valid email address";
  }
  if (isEmpty(data.password)) {
    errors.password = "Must not be empty";
  }
  if (data.password !== data.confirmPassword) {
    errors.confirmPassword = "Passwords must match";
  }
  if (isEmpty(data.handle)) {
    errors.handle = "Must not be empty";
  }

  return {
    errors,
    valid: !Object.keys(errors).length,
  };
};

export const validateLoginData = (data: Record<string, string>): ValidateResponse => {
  const errors = {} as Record<string, string>;

  if (isEmpty(data.email)) {
    errors.email = "Must not be empty";
  }
  if (isEmpty(data.password)) {
    errors.password = "Must not be empty";
  }

  return {
    errors,
    valid: !Object.keys(errors).length,
  };
};

export const reduceUserDetails = (data: Record<string, string>): Record<string, string> => {
  const userDetails = {} as Record<string, string>;

  if (!isEmpty(data.bio.trim())) {
    userDetails.bio = data.bio;
  }

  if (!isEmpty(data.website.trim())) {
    if (data.website.trim().substring(0, 4) !== "http") {
      userDetails.website = `http://${data.website.trim()}`;
    } else userDetails.website = data.website.trim();
  }

  if (!isEmpty(data.location.trim())) {
    userDetails.location = data.location.trim();
  }

  return userDetails;
};
