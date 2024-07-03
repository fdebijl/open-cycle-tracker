class UsersController < ApplicationController
  before_action :find_user, only: %i[show update]

  def index
    raise NotImplementedError
  end

  def show
    authorize @user
    render json: @user
  end

  def update
    authorize @user
    @user.update! permitted_attributes(@user)
  end

  protected

  def find_user
    @user = policy_scope(resource_class).find(params[:id])
  end
end
